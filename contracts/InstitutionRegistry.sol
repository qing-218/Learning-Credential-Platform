
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract InstitutionRegistry is AccessControl {

    // Custom errors
    error ZeroAddress();
    error InstitutionAlreadyApproved();
    error InstitutionNotApproved();

    // Approved institution records
    mapping(address => bool) public approvedInstitutions;

    // Events
    event InstitutionApproved(address indexed institution);
    event InstitutionRemoved(address indexed institution);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Approve an educational institution
    function approveInstitution(address institution)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (institution == address(0)) {
            revert ZeroAddress();
        }

        if (approvedInstitutions[institution]) {
            revert InstitutionAlreadyApproved();
        }

        approvedInstitutions[institution] = true;

        emit InstitutionApproved(institution);
    }

    // Remove an educational institution
    function removeInstitution(address institution)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (institution == address(0)) {
            revert ZeroAddress();
        }

        if (!approvedInstitutions[institution]) {
            revert InstitutionNotApproved();
        }

        approvedInstitutions[institution] = false;

        emit InstitutionRemoved(institution);
    }

    // Check institution authorization
    function isApprovedInstitution(address institution)
        external
        view
        returns (bool)
    {
        return approvedInstitutions[institution];
    }
}
