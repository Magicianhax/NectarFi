export const listaStakeManagerAbi = [
  // Stake BNB for slisBNB
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  // Initiate unstake (7-15 day delay)
  {
    name: 'requestWithdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
  },
  // Claim BNB after unstake delay
  {
    name: 'claimWithdraw',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_idx', type: 'uint256' }],
    outputs: [],
  },
  // Convert slisBNB amount to BNB equivalent
  {
    name: 'convertSnBnbToBnb',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Convert BNB amount to slisBNB equivalent
  {
    name: 'convertBnbToSnBnb',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // List pending withdrawal requests
  {
    name: 'getUserWithdrawalRequests',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'uuid', type: 'uint256' },
          { name: 'amountInSnBnb', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
        ],
      },
    ],
  },
  // Check if a withdrawal is claimable
  {
    name: 'getUserRequestStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '_address', type: 'address' },
      { name: '_idx', type: 'uint256' },
    ],
    outputs: [{ name: '_claimable', type: 'bool' }],
  },
] as const;
