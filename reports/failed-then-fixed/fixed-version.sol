
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract AchievementManager is AccessControl {

    error ZeroAddress();
    error CredentialContractAlreadySet();
    error UnauthorizedCredentialContract();
    error InsufficientPoints();

    // Learner achievement points
    mapping(address => uint256) public achievementPoints;

    // 0 = Bronze, 1 = Silver, 2 = Gold, 3 = Platinum
    mapping(address => uint8) private learnerTiers;

    // Authorized NFT contract
    address public credentialContract;

    // Events
    event AchievementUpdated(
        address indexed learner,
        uint256 previousPoints,
        uint256 newPoints
    );

    event TierChanged(
        address indexed learner,
        string previousTier,
        string newTier
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyCredentialContract() {
        if (msg.sender != credentialContract) {
            revert UnauthorizedCredentialContract();
        }
        _;
    }

    // Set the authorized NFT contract once
    function setCredentialContract(address nftContract)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (nftContract == address(0)) {
            revert ZeroAddress();
        }

        if (credentialContract != address(0)) {
            revert CredentialContractAlreadySet();
        }

        credentialContract = nftContract;
    }

    // Add or deduct achievement points
    function updatePoints(
        address learner,
        uint256 points,
        bool increase
    )
        external
        onlyCredentialContract
    {
        if (learner == address(0)) {
            revert ZeroAddress();
        }

        uint256 previousPoints = achievementPoints[learner];
        uint256 newPoints;

        if (increase) {
            newPoints = previousPoints + points;
        } else {
            if (points > previousPoints) {
                revert InsufficientPoints();
            }

            newPoints = previousPoints - points;
        }

        uint8 previousTier = learnerTiers[learner];
        uint8 newTier = calculateTier(newPoints);

        achievementPoints[learner] = newPoints;
        learnerTiers[learner] = newTier;

        emit AchievementUpdated(
            learner,
            previousPoints,
            newPoints
        );

        // Emit event only when the tier changes
        if (previousTier != newTier) {
            emit TierChanged(
                learner,
                tierName(previousTier),
                tierName(newTier)
            );
        }
    }

    // Calculate learner tier
    function calculateTier(uint256 points)
        public
        pure
        returns (uint8)
    {
        if (points >= 600) return 3;
        if (points >= 300) return 2;
        if (points >= 100) return 1;

        return 0;
    }

    // Convert tier number to name
    function tierName(uint8 tier)
        public
        pure
        returns (string memory)
    {
        if (tier == 0) return "Bronze";
        if (tier == 1) return "Silver";
        if (tier == 2) return "Gold";
        if (tier == 3) return "Platinum";

        revert();
    }

    // Public learner tier query
    function getLearnerTier(address learner)
        external
        view
        returns (string memory)
    {
        return tierName(
            calculateTier(achievementPoints[learner])
        );
    }
}
