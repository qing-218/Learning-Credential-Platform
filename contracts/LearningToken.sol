
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract LearningToken is ERC20, AccessControl {

    bytes32 public constant MINTER_ROLE =
        keccak256("MINTER_ROLE");

    error InvalidAddress();

    event RewardMinted(
        address indexed learner,
        uint256 amount
    );

    constructor()
        ERC20("Learning Token", "LRN")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function mintReward(
        address learner,
        uint256 amount
    )
        external
        onlyRole(MINTER_ROLE)
    {
        if (learner == address(0)) {
            revert InvalidAddress();
        }

        _mint(learner, amount);

        emit RewardMinted(learner, amount);
    }
}
