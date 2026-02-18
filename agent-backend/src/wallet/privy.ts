import { PrivyClient } from '@privy-io/server-auth';
import { publicClient } from '../data/onchain.js';
import { CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from '@hpke/core';
import { Chacha20Poly1305 } from '@hpke/chacha20poly1305';
import { p256 } from '@noble/curves/p256';
import { sha256 } from '@noble/hashes/sha256';
import canonicalize from 'canonicalize';
import crypto from 'crypto';

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

// ── Privy Auth Token Verification ──

// Cache: Privy DID → { dbUserId, walletAddress }
const authCache = new Map<string, { dbUserId: string; walletAddress: string; cachedAt: number }>();
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 min

/**
 * Verify a Privy access token and resolve to our DB userId + wallet address.
 * Uses local JWT verification (fast) + caches the Privy DID → user mapping.
 */
export async function verifyPrivyAuth(token: string): Promise<{ dbUserId: string; walletAddress: string }> {
  const claims = await privy.verifyAuthToken(token);
  const privyDid = claims.userId;

  const cached = authCache.get(privyDid);
  if (cached && Date.now() - cached.cachedAt < AUTH_CACHE_TTL) {
    return { dbUserId: cached.dbUserId, walletAddress: cached.walletAddress };
  }

  // Fetch linked wallet from Privy
  const privyUser = await privy.getUser(privyDid);
  const walletAddr = privyUser.wallet?.address;
  if (!walletAddr) {
    throw new Error('No wallet linked to Privy account');
  }

  // Look up our DB user by eoa_address
  const { supabase: sb } = await import('../db/supabase.js');
  const { data: dbUser } = await sb
    .from('users')
    .select('id')
    .eq('eoa_address', walletAddr.toLowerCase())
    .maybeSingle();

  if (!dbUser) {
    throw new Error('User not found in database');
  }

  const result = { dbUserId: dbUser.id, walletAddress: walletAddr.toLowerCase() };
  authCache.set(privyDid, { ...result, cachedAt: Date.now() });
  return result;
}

// Create an embedded wallet for a new user's agent (with P-256 owner for export support)
export async function createAgentWallet(userId: string): Promise<{
  address: string;
  walletId: string;
  ownerPrivateKey: string;
}> {
  // Generate P-256 keypair for wallet ownership (needed for PK export)
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );

  const pubDer = await crypto.subtle.exportKey('spki', publicKey);
  const privDer = await crypto.subtle.exportKey('pkcs8', privateKey);
  const pubB64 = Buffer.from(pubDer).toString('base64');
  const privB64 = Buffer.from(privDer).toString('base64');

  const wallet = await privy.walletApi.create({
    chainType: 'ethereum',
    owner: { publicKey: pubB64 },
  });

  return { address: wallet.address, walletId: wallet.id, ownerPrivateKey: privB64 };
}

// Build Privy authorization signature for a wallet API request
function buildAuthorizationSignature(
  ownerAuthKey: string,
  method: string,
  url: string,
  bodyObj: Record<string, unknown>,
): string {
  const appId = process.env.PRIVY_APP_ID!;
  const privKeyDer = Buffer.from(ownerAuthKey, 'base64');
  const markerIdx = privKeyDer.indexOf(Buffer.from([0x04, 0x20]));
  const scalar = privKeyDer.subarray(markerIdx + 2, markerIdx + 34);
  const privKeyScalar = p256.utils.normPrivateKeyToScalar(scalar);

  const payload = {
    version: 1,
    method,
    url,
    body: bodyObj,
    headers: { 'privy-app-id': appId },
  };

  const canonicalized = Buffer.from(canonicalize(payload)!);
  const hash = sha256(canonicalized);
  const sig = p256.sign(hash, privKeyScalar).toDERRawBytes();
  return Buffer.from(sig).toString('base64');
}

// Send a transaction from the agent wallet via REST API (with per-wallet owner auth signature)
export async function sendTransaction(
  walletId: string,
  ownerAuthKey: string,
  tx: { to: `0x${string}`; data: `0x${string}`; value?: bigint }
): Promise<string> {
  const appId = process.env.PRIVY_APP_ID!;
  const appSecret = process.env.PRIVY_APP_SECRET!;
  const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  const rpcUrl = `https://api.privy.io/v1/wallets/${walletId}/rpc`;
  const bodyObj: Record<string, unknown> = {
    method: 'eth_sendTransaction',
    caip2: 'eip155:56',
    params: {
      transaction: {
        to: tx.to,
        data: tx.data,
        value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
      },
    },
  };

  const sigB64 = buildAuthorizationSignature(ownerAuthKey, 'POST', rpcUrl, bodyObj);

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
      'privy-app-id': appId,
      'privy-authorization-signature': sigB64,
    },
    body: JSON.stringify(bodyObj),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Privy sendTransaction failed: ${res.status} ${err}`);
  }

  const data = await res.json() as { data: { hash: string } };
  const txHash = data.data.hash as `0x${string}`;

  // Wait for on-chain confirmation before returning (critical for chained ops like approve→supply)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === 'reverted') throw new Error(`Transaction reverted: ${txHash}`);
  console.log(`[PRIVY-TX] Confirmed: ${txHash} (gas: ${receipt.gasUsed})`);
  return txHash;
}

// Get wallet address by wallet ID
export async function getWalletAddress(walletId: string): Promise<string> {
  const wallet = await privy.walletApi.getWallet({ id: walletId });
  return wallet.address;
}

// Create a sendTx function bound to a specific wallet + auth key
export function createSendTxFn(walletId: string, ownerAuthKey: string) {
  return async (tx: { to: `0x${string}`; data: `0x${string}`; value?: bigint }) => {
    return sendTransaction(walletId, ownerAuthKey, tx);
  };
}

// Export private key using Privy REST API + HPKE (matching Privy SDK internals)
export async function exportWalletPrivateKey(walletId: string, ownerAuthKey: string): Promise<string> {
  // 1. Generate P-256 keypair for HPKE encryption (SPKI format, same as Privy's createP256KeyPair)
  const ecKeypair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const spkiPub = await crypto.subtle.exportKey('spki', ecKeypair.publicKey);
  const pkcs8Priv = await crypto.subtle.exportKey('pkcs8', ecKeypair.privateKey);
  const recipientPublicKey = Buffer.from(spkiPub).toString('base64');
  const recipientPrivateKeyB64 = Buffer.from(pkcs8Priv).toString('base64');

  // 2. Build request body
  const appId = process.env.PRIVY_APP_ID!;
  const appSecret = process.env.PRIVY_APP_SECRET!;
  const basicAuth = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  const bodyObj = {
    encryption_type: 'HPKE' as const,
    recipient_public_key: recipientPublicKey,
  };
  const bodyStr = JSON.stringify(bodyObj);

  // 3. Build authorization signature (matching Privy SDK internals)
  const privKeyDer = Buffer.from(ownerAuthKey, 'base64');
  const markerIdx = privKeyDer.indexOf(Buffer.from([0x04, 0x20]));
  const scalar = privKeyDer.subarray(markerIdx + 2, markerIdx + 34);
  const privKeyScalar = p256.utils.normPrivateKeyToScalar(scalar);

  const payload = {
    version: 1,
    method: 'POST' as const,
    url: `https://api.privy.io/v1/wallets/${walletId}/export`,
    body: bodyObj,
    headers: { 'privy-app-id': appId },
  };

  const canonicalized = Buffer.from(canonicalize(payload)!);
  const hash = sha256(canonicalized);
  const sig = p256.sign(hash, privKeyScalar).toDERRawBytes();
  const sigB64 = Buffer.from(sig).toString('base64');

  // 4. Call Privy export API
  const res = await fetch(`https://api.privy.io/v1/wallets/${walletId}/export`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
      'privy-app-id': appId,
      'privy-authorization-signature': sigB64,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Privy export failed: ${res.status} ${err}`);
  }

  const data = await res.json() as {
    ciphertext: string;
    encapsulated_key: string;
  };

  // 5. Decrypt using HPKE (matching Privy's decryptHPKEMessage)
  const suite = new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });

  // Import recipient private key as ECDH (same as Privy does internally)
  const privKeyBuf = Buffer.from(recipientPrivateKeyB64, 'base64');
  const recipientKey = await crypto.subtle.importKey(
    'pkcs8', privKeyBuf,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );

  const encBuf = new Uint8Array(Buffer.from(data.encapsulated_key, 'base64')).buffer;
  const ctBuf = new Uint8Array(Buffer.from(data.ciphertext, 'base64')).buffer;

  const recipient = await suite.createRecipientContext({
    recipientKey: recipientKey as unknown as CryptoKey,
    enc: encBuf,
  });

  const decrypted = await recipient.open(ctBuf);
  return new TextDecoder().decode(decrypted);
}
