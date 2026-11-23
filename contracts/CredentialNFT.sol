
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./InstitutionRegistry.sol";
import "./AchievementManager.sol";
import "./LearningToken.sol";

contract CredentialNFT is
    ERC721URIStorage,
    AccessControl,
    ReentrancyGuard
{
    error ZeroAddress();
    error EmptyMetadataURI();
    error InstitutionNotApproved();
    error CredentialNotFound();
    error CredentialAlreadyRevoked();
    error UnauthorizedRevocation();
    error EmptyRevocationReason();
    error NonTransferable();

    // 5 LRN with 18 decimals
    uint256 public constant REWARD_AMOUNT = 5 * 10 ** 18;

    struct Credential {
        address learner;
        address institution;
        uint256 points;
        bool revoked;
        string revocationReason;
    }

    InstitutionRegistry public immutable registry;
    AchievementManager public immutable achievementManager;
    LearningToken public immutable learningToken;

    uint256 public nextTokenId = 1;

    mapping(uint256 => Credential) public credentials;

    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed learner,
        address indexed institution,
        uint256 points
    );

    event CredentialRevoked(
        uint256 indexed tokenId,
        address indexed institution,
        string reason
    );

    constructor(
        address registryAddress,
        address achievementAddress,
        address learningTokenAddress
    )
        ERC721("Learning Credential", "LCRED")
    {
        if (
            registryAddress == address(0) ||
            achievementAddress == address(0) ||
            learningTokenAddress == address(0)
        ) {
            revert ZeroAddress();
        }

        registry = InstitutionRegistry(registryAddress);
        achievementManager = AchievementManager(achievementAddress);
        learningToken = LearningToken(learningTokenAddress);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }


    function issueCredential(
        address learner,
        string calldata metadataURI,
        uint256 points
    )
        external
        nonReentrant
        returns (uint256 tokenId)
    {
        if (learner == address(0)) {
            revert ZeroAddress();
        }

        if (bytes(metadataURI).length == 0) {
            revert EmptyMetadataURI();
        }

        if (!registry.isApprovedInstitution(msg.sender)) {
            revert InstitutionNotApproved();
        }

        // 1. Allocate a unique token ID
        tokenId = nextTokenId++;

        // 2. Record credential information
        credentials[tokenId] = Credential({
            learner: learner,
            institution: msg.sender,
            points: points,
            revoked: false,
            revocationReason: ""
        });

        // 3. Mint NFT first
        // _safeMint checks whether the receiver supports ERC721
        _mint(learner, tokenId);

        // 4. Set metadata after the NFT exists
        _setTokenURI(tokenId, metadataURI);

        // 5. Update achievement points
        achievementManager.updatePoints(
            learner,
            points,
            true
        );

        // 6. Reward learner with 5 LRN
        learningToken.mintReward(
            learner,
            REWARD_AMOUNT
        );

        // 7. Emit issuance event
        emit CredentialIssued(
            tokenId,
            learner,
            msg.sender,
            points
        );
    }


    // Revoke a credential without burning the NFT
    function revokeCredential(
        uint256 tokenId,
        string calldata reason
    )
        external
        nonReentrant
    {
        if (_ownerOf(tokenId) == address(0)) {
            revert CredentialNotFound();
        }

        Credential storage credential = credentials[tokenId];

        if (credential.revoked) {
            revert CredentialAlreadyRevoked();
        }

        bool isIssuer =
            msg.sender == credential.institution;

        bool isAdmin =
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender);

        if (!isIssuer && !isAdmin) {
            revert UnauthorizedRevocation();
        }

        if (bytes(reason).length == 0) {
            revert EmptyRevocationReason();
        }

        // Update revocation status and reason
        credential.revoked = true;
        credential.revocationReason = reason;

        // Deduct the points awarded by this credential
        achievementManager.updatePoints(
            credential.learner,
            credential.points,
            false
        );

        // LRN rewards are not reclaimed after revocation

        emit CredentialRevoked(
            tokenId,
            credential.institution,
            reason
        );
    }

    // Public credential verification
    function isCredentialValid(uint256 tokenId)
        external
        view
        returns (bool)
    {
        return
            _ownerOf(tokenId) != address(0) &&
            !credentials[tokenId].revoked;
    }

    // Get complete credential information
    function getCredential(uint256 tokenId)
        external
        view
        returns (
            address learner,
            address institution,
            uint256 points,
            bool revoked,
            string memory reason,
            string memory metadataURI
        )
    {
        if (_ownerOf(tokenId) == address(0)) {
            revert CredentialNotFound();
        }

        Credential storage c = credentials[tokenId];

        return (
            c.learner,
            c.institution,
            c.points,
            c.revoked,
            c.revocationReason,
            tokenURI(tokenId)
        );
    }

    // Block all NFT transfers and burns after minting
    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override(ERC721)
        returns (address)
    {
        address from = _ownerOf(tokenId);

        if (from != address(0)) {
            revert NonTransferable();
        }

        return super._update(to, tokenId, auth);
    }

    // ERC721 interface support
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
