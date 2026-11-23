
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("Learning Credential Platform Integration", function () {

    let viem;

    let admin;
    let institution;
    let learner;
    let attacker;

    let registry;
    let achievementManager;
    let learningToken;
    let credentialNFT;

    const REWARD_AMOUNT = 5n * 10n ** 18n;
    const CREDENTIAL_POINTS = 150n;

    beforeEach(async function () {
        const connection = await network.connect();
        viem = connection.viem;

        const wallets = await viem.getWalletClients();

        [admin, institution, learner, attacker] = wallets;

        // 1. Deploy InstitutionRegistry
        registry = await viem.deployContract(
            "InstitutionRegistry"
        );

        // 2. Deploy AchievementManager
        achievementManager = await viem.deployContract(
            "AchievementManager"
        );

        // 3. Deploy LearningToken
        learningToken = await viem.deployContract(
            "LearningToken"
        );

        // 4. Deploy CredentialNFT
        credentialNFT = await viem.deployContract(
            "CredentialNFT",
            [
                registry.address,
                achievementManager.address,
                learningToken.address
            ]
        );

        // 5. Connect admin clients
        const registryAsAdmin = await viem.getContractAt(
            "InstitutionRegistry",
            registry.address,
            { client: { wallet: admin } }
        );

        const achievementAsAdmin = await viem.getContractAt(
            "AchievementManager",
            achievementManager.address,
            { client: { wallet: admin } }
        );

        const tokenAsAdmin = await viem.getContractAt(
            "LearningToken",
            learningToken.address,
            { client: { wallet: admin } }
        );

        // 6. Approve the institution
        await registryAsAdmin.write.approveInstitution([
            institution.account.address
        ]);

        // 7. Authorize CredentialNFT to update achievement points
        await achievementAsAdmin.write.setCredentialContract([
            credentialNFT.address
        ]);

        // 8. Authorize CredentialNFT to mint LRN
        const minterRole = await learningToken.read.MINTER_ROLE();

        await tokenAsAdmin.write.grantRole([
            minterRole,
            credentialNFT.address
        ]);
    });

    it("should automatically reward 5 LRN when a credential is issued", async function () {

        const credentialAsInstitution = await viem.getContractAt(
            "CredentialNFT",
            credentialNFT.address,
            { client: { wallet: institution } }
        );

        await credentialAsInstitution.write.issueCredential([
            learner.account.address,
            "ipfs://example-certificate-001",
            CREDENTIAL_POINTS
        ]);

        // Check NFT ownership
        const owner = await credentialNFT.read.ownerOf([1n]);

        assert.equal(
            owner.toLowerCase(),
            learner.account.address.toLowerCase()
        );

        // Check achievement points
        const points = await achievementManager.read.achievementPoints([
            learner.account.address
        ]);

        assert.equal(points, CREDENTIAL_POINTS);

        // Check LRN reward
        const balance = await learningToken.read.balanceOf([
            learner.account.address
        ]);

        assert.equal(balance, REWARD_AMOUNT);

        // Check total token supply
        const totalSupply = await learningToken.read.totalSupply();

        assert.equal(totalSupply, REWARD_AMOUNT);
    });

    it("should keep LRN rewards after credential revocation", async function () {

        const credentialAsInstitution = await viem.getContractAt(
            "CredentialNFT",
            credentialNFT.address,
            { client: { wallet: institution } }
        );

        await credentialAsInstitution.write.issueCredential([
            learner.account.address,
            "ipfs://example-certificate-002",
            CREDENTIAL_POINTS
        ]);

        // Revoke the credential
        await credentialAsInstitution.write.revokeCredential([
            1n,
            "Credential revoked for testing"
        ]);

        // NFT should still exist
        const owner = await credentialNFT.read.ownerOf([1n]);

        assert.equal(
            owner.toLowerCase(),
            learner.account.address.toLowerCase()
        );

        // Credential should become invalid
        const isValid = await credentialNFT.read.isCredentialValid([
            1n
        ]);

        assert.equal(isValid, false);

        // Achievement points should be deducted
        const points = await achievementManager.read.achievementPoints([
            learner.account.address
        ]);

        assert.equal(points, 0n);

        // Previously issued LRN should remain
        const balance = await learningToken.read.balanceOf([
            learner.account.address
        ]);

        assert.equal(balance, REWARD_AMOUNT);
    });

    it("should not reward an unapproved institution", async function () {

        const credentialAsAttacker = await viem.getContractAt(
            "CredentialNFT",
            credentialNFT.address,
            { client: { wallet: attacker } }
        );

        await assert.rejects(
            async () => {
                await credentialAsAttacker.write.issueCredential([
                    learner.account.address,
                    "ipfs://unauthorized-certificate",
                    CREDENTIAL_POINTS
                ]);
            }
        );

        // No NFT should be issued
        assert.equal(
            await credentialNFT.read.nextTokenId(),
            1n
        );

        // No points should be awarded
        assert.equal(
            await achievementManager.read.achievementPoints([
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

        assert.equal(
            await learningToken.read.totalSupply(),
            0n
        );
    });
});
