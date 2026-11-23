
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("CredentialNFT", async function () {

    const { viem } = await network.connect();

    const wallets = await viem.getWalletClients();

    const admin = wallets[0];
    const institution = wallets[1];
    const learner = wallets[2];
    const otherUser = wallets[3];

    const metadataURI =
        "ipfs://bafy-example-001/metadata.json";

    // 5 LRN, with 18 decimals
    const REWARD_AMOUNT = 5n * 10n ** 18n;

    async function deploySystem() {

        // 1. Deploy InstitutionRegistry
        const registry = await viem.deployContract(
            "InstitutionRegistry"
        );

        // 2. Deploy AchievementManager
        const manager = await viem.deployContract(
            "AchievementManager"
        );

        // 3. Deploy LearningToken
        const learningToken = await viem.deployContract(
            "LearningToken"
        );

        // 4. Deploy CredentialNFT
        const nft = await viem.deployContract(
            "CredentialNFT",
            [
                registry.address,
                manager.address,
                learningToken.address
            ]
        );

        // 5. Authorize CredentialNFT to update achievement points
        await manager.write.setCredentialContract([
            nft.address
        ]);

        // 6. Grant MINTER_ROLE to CredentialNFT
        const minterRole = await learningToken.read.MINTER_ROLE();

        await learningToken.write.grantRole([
            minterRole,
            nft.address
        ]);

        // 7. Approve educational institution
        await registry.write.approveInstitution([
            institution.account.address
        ]);

        // 8. Connect institution wallet to CredentialNFT
        const issuerNFT = await viem.getContractAt(
            "CredentialNFT",
            nft.address,
            { client: { wallet: institution } }
        );

        // 9. Connect learner wallet to CredentialNFT
        const learnerNFT = await viem.getContractAt(
            "CredentialNFT",
            nft.address,
            { client: { wallet: learner } }
        );

        // 10. Connect other user wallet to CredentialNFT
        const otherUserNFT = await viem.getContractAt(
            "CredentialNFT",
            nft.address,
            { client: { wallet: otherUser } }
        );

        return {
            registry,
            manager,
            learningToken,
            nft,
            issuerNFT,
            learnerNFT,
            otherUserNFT
        };
    }

    // =========================================================
    // 1. Credential Issuance
    // =========================================================

    it("Should issue an NFT credential successfully", async function () {

        const { nft, issuerNFT } = await deploySystem();

        await issuerNFT.write.issueCredential([
            learner.account.address,
            metadataURI,
            150n
        ]);

        const owner = await nft.read.ownerOf([1n]);

        assert.equal(
            owner.toLowerCase(),
            learner.account.address.toLowerCase()
        );

        assert.equal(
            await nft.read.tokenURI([1n]),
            metadataURI
        );
    });

    it("Should assign achievement points after issuance", async function () {

        const { manager, issuerNFT } = await deploySystem();

        await issuerNFT.write.issueCredential([
            learner.account.address,
            metadataURI,
            150n
        ]);

        const points = await manager.read.achievementPoints([
            learner.account.address
        ]);

        assert.equal(points, 150n);

        assert.equal(
            await manager.read.getLearnerTier([
                learner.account.address
            ]),
            "Silver"
        );
    });

    it("Should automatically reward 5 LRN after credential issuance", async function () {

        const { learningToken, issuerNFT } = await deploySystem();

        await issuerNFT.write.issueCredential([
            learner.account.address,
            metadataURI,
            150n
        ]);

        const balance = await learningToken.read.balanceOf([
            learner.account.address
        ]);

        assert.equal(balance, REWARD_AMOUNT);

        const totalSupply = await learningToken.read.totalSupply();

        assert.equal(totalSupply, REWARD_AMOUNT);
    });

    it("Should reject issuance by an unapproved institution", async function () {

        const { nft, learningToken, manager } = await deploySystem();

        const unauthorizedNFT = await viem.getContractAt(
            "CredentialNFT",
            nft.address,
            { client: { wallet: otherUser } }
        );

        await assert.rejects(async () => {
            await unauthorizedNFT.write.issueCredential([
                learner.account.address,
                metadataURI,
                150n
            ]);
        });

        // No NFT should be issued
        assert.equal(
            await nft.read.nextTokenId(),
            1n
        );

        // No achievement points should be awarded
        assert.equal(
            await manager.read.achievementPoints([
                learner.account.address
            ]),
            0n
        );

        // No LRN should be minted
        assert.equal(
            await learningToken.read.balanceOf([
                learner.account.address
            ]),
            0n
        );
    });

    it("Should reject zero learner address", async function () {

        const { issuerNFT, learningToken } = await deploySystem();

        await assert.rejects(async () => {
            await issuerNFT.write.issueCredential([
                "0x0000000000000000000000000000000000000000",
                metadataURI,
                150n
            ]);
        });

        assert.equal(
            await learningToken.read.totalSupply(),
            0n
        );
    });

    it("Should reject empty metadata URI", async function () {

        const { issuerNFT, learningToken } = await deploySystem();

        await assert.rejects(async () => {
            await issuerNFT.write.issueCredential([
                learner.account.address,
                "",
                150n
            ]);
        });

        assert.equal(
            await learningToken.read.totalSupply(),
            0n
        );
    });

    // =========================================================
    // 2. NFT Transfer Restrictions
    // =========================================================

    it("Should reject NFT transfer", async function () {

        const { issuerNFT, learnerNFT } = await deploySystem();

        await issuerNFT.write.issueCredential([
            learner.account.address,
            metadataURI,
            150n
        ]);

        await assert.rejects(async () => {
            await learnerNFT.write.transferFrom([
                learner.account.address,
                otherUser.account.address,
                1n
            ]);
        });
    });

    // =========================================================
    // 3. Credential Revocation
    // =========================================================

    it("Should revoke a credential without deleting the NFT", async function () {

        const { nft, issuerNFT } = await deploySystem();

        await issuerNFT.write.issueCredential([
            learner.account.address,
            metadataURI,
            150n
        ]);

        await issuerNFT.write.revokeCredential([
            1n,
            "Credential issued in error"
        ]);

        // NFT should still exist
        const owner = await nft.read.ownerOf([1n]);

        assert.equal(
            owner.toLowerCase(),
            learner.account.address.toLowerCase()
        );

        // Credential should no longer be valid
        assert.equal(
            await nft.read.isCredentialValid([1n]),
            false
        );
    });

    it("Should deduct points after revocation", async function () {

        const { manager, issuerNFT } = await deploySystem();

        await issuerNFT.write.issueCredential([
            learner.account.address,
            metadataURI,
            150n
        ]);

        await issuerNFT.write.revokeCredential([
            1n,
            "Incorrect issuance"
        ]);

        const points = await manager.read.achievementPoints([
            learner.account.address
        ]);

        assert.equal(points, 0n);

        assert.equal(
            await manager.read.getLearnerTier([
                learner.account.address
            ]),
            "Bronze"
        );
    });

    it("Should preserve LRN rewards after credential revocation", async function () {

        const { learningToken, issuerNFT } = await deploySystem();

        await issuerNFT.write.issueCredential([
            learner.account.address,
            metadataURI,
            150n
        ]);

        // Learner receives 5 LRN
        assert.equal(
            await learningToken.read.balanceOf([
                learner.account.address
            ]),
            REWARD_AMOUNT
        );

        // Institution revokes the credential
        await issuerNFT.write.revokeCredential([
            1n,
            "Incorrect certificate"
        ]);

        // LRN reward should remain unchanged
        assert.equal(
            await learningToken.read.balanceOf([
                learner.account.address
            ]),
            REWARD_AMOUNT
        );

        // Total supply should also remain unchanged
        assert.equal(
            await learningToken.read.totalSupply(),
            REWARD_AMOUNT
        );
    });

    it("Should reject unauthorized revocation", async function () {

        const { nft, issuerNFT } = await deploySystem();

        await issuerNFT.write.issueCredential([
            learner.account.address,
            metadataURI,
            150n
        ]);

        const unauthorizedNFT = await viem.getContractAt(
            "CredentialNFT",
            nft.address,
            { client: { wallet: otherUser } }
        );

        await assert.rejects(async () => {
            await unauthorizedNFT.write.revokeCredential([
                1n,
                "Unauthorized revocation"
            ]);
        });
    });

    it("Should reject duplicate revocation", async function () {

        const { issuerNFT } = await deploySystem();

        await issuerNFT.write.issueCredential([
            learner.account.address,
            metadataURI,
            150n
        ]);

        await issuerNFT.write.revokeCredential([
            1n,
            "First revocation"
        ]);

        await assert.rejects(async () => {
            await issuerNFT.write.revokeCredential([
                1n,
                "Second revocation"
            ]);
        });
    });

    it("Should reject verification of a nonexistent credential", async function () {

        const { nft } = await deploySystem();

        assert.equal(
            await nft.read.isCredentialValid([999n]),
            false
        );
    });

    it("Should reject revocation of a nonexistent credential", async function () {

        const { issuerNFT } = await deploySystem();

        await assert.rejects(async () => {
            await issuerNFT.write.revokeCredential([
                999n,
                "Nonexistent credential"
            ]);
        });
    });

    // =========================================================
    // 4. Multiple Credential Integration
    // =========================================================

    it("Should correctly update points and rewards when multiple credentials are issued and revoked", async function () {

        const {
            manager,
            learningToken,
            issuerNFT
        } = await deploySystem();

        // Issue the first credential: 150 points
        await issuerNFT.write.issueCredential([
            learner.account.address,
            "ipfs://certificate-1",
            150n
        ]);

        // Issue the second credential: 200 points
        await issuerNFT.write.issueCredential([
            learner.account.address,
            "ipfs://certificate-2",
            200n
        ]);

        // Check total achievement points
        let points = await manager.read.achievementPoints([
            learner.account.address
        ]);

        assert.equal(points, 350n);

        assert.equal(
            await manager.read.getLearnerTier([
                learner.account.address
            ]),
            "Gold"
        );

        // Check total LRN rewards: 10 LRN
        let balance = await learningToken.read.balanceOf([
            learner.account.address
        ]);

        assert.equal(
            balance,
            2n * REWARD_AMOUNT
        );

        // Revoke the first credential
        await issuerNFT.write.revokeCredential([
            1n,
            "Incorrect certificate"
        ]);

        // Achievement points decrease from 350 to 200
        points = await manager.read.achievementPoints([
            learner.account.address
        ]);

        assert.equal(points, 200n);

        assert.equal(
            await manager.read.getLearnerTier([
                learner.account.address
            ]),
            "Silver"
        );

        // LRN rewards remain 10 LRN
        balance = await learningToken.read.balanceOf([
            learner.account.address
        ]);

        assert.equal(
            balance,
            2n * REWARD_AMOUNT
        );
    });

});
