
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("LearningToken", function () {

    let viem;
    let publicClient;

    let admin;
    let minter;
    let learner;
    let attacker;

    let token;

    const REWARD_AMOUNT = 5n * 10n ** 18n;

    beforeEach(async function () {
        const connection = await network.connect();

        viem = connection.viem;
        publicClient = await viem.getPublicClient();

        const wallets = await viem.getWalletClients();

        [admin, minter, learner, attacker] = wallets;

        // Deploy LearningToken
        token = await viem.deployContract("LearningToken");
    });

    it("should have the correct token information", async function () {
        assert.equal(
            await token.read.name(),
            "Learning Token"
        );

        assert.equal(
            await token.read.symbol(),
            "LRN"
        );

        assert.equal(
            await token.read.decimals(),
            18
        );

        assert.equal(
            await token.read.totalSupply(),
            0n
        );
    });

    it("should assign the admin role to the deployer", async function () {
        const adminRole = await token.read.DEFAULT_ADMIN_ROLE();

        const hasAdminRole = await token.read.hasRole([
            adminRole,
            admin.account.address
        ]);

        assert.equal(hasAdminRole, true);
    });

    it("should allow the admin to grant MINTER_ROLE", async function () {
        const minterRole = await token.read.MINTER_ROLE();

        const tokenAsAdmin = await viem.getContractAt(
            "LearningToken",
            token.address,
            { client: { wallet: admin } }
        );

        await tokenAsAdmin.write.grantRole([
            minterRole,
            minter.account.address
        ]);

        const hasMinterRole = await token.read.hasRole([
            minterRole,
            minter.account.address
        ]);

        assert.equal(hasMinterRole, true);
    });

    it("should allow an authorized minter to mint reward tokens", async function () {
        const minterRole = await token.read.MINTER_ROLE();

        const tokenAsAdmin = await viem.getContractAt(
            "LearningToken",
            token.address,
            { client: { wallet: admin } }
        );

        await tokenAsAdmin.write.grantRole([
            minterRole,
            minter.account.address
        ]);

        const tokenAsMinter = await viem.getContractAt(
            "LearningToken",
            token.address,
            { client: { wallet: minter } }
        );

        await tokenAsMinter.write.mintReward([
            learner.account.address,
            REWARD_AMOUNT
        ]);

        const learnerBalance = await token.read.balanceOf([
            learner.account.address
        ]);

        const totalSupply = await token.read.totalSupply();

        assert.equal(learnerBalance, REWARD_AMOUNT);
        assert.equal(totalSupply, REWARD_AMOUNT);
    });

    it("should reject minting from an unauthorized account", async function () {
        const tokenAsAttacker = await viem.getContractAt(
            "LearningToken",
            token.address,
            { client: { wallet: attacker } }
        );

        await assert.rejects(
            async () => {
                await tokenAsAttacker.write.mintReward([
                    learner.account.address,
                    REWARD_AMOUNT
                ]);
            }
        );

        assert.equal(
            await token.read.balanceOf([learner.account.address]),
            0n
        );

        assert.equal(
            await token.read.totalSupply(),
            0n
        );
    });

    it("should reject minting to the zero address", async function () {
        const minterRole = await token.read.MINTER_ROLE();

        const tokenAsAdmin = await viem.getContractAt(
            "LearningToken",
            token.address,
            { client: { wallet: admin } }
        );

        await tokenAsAdmin.write.grantRole([
            minterRole,
            minter.account.address
        ]);

        const tokenAsMinter = await viem.getContractAt(
            "LearningToken",
            token.address,
            { client: { wallet: minter } }
        );

        await assert.rejects(
            async () => {
                await tokenAsMinter.write.mintReward([
                    "0x0000000000000000000000000000000000000000",
                    REWARD_AMOUNT
                ]);
            }
        );

        assert.equal(
            await token.read.totalSupply(),
            0n
        );
    });

    it("should revoke MINTER_ROLE and prevent further minting", async function () {
        const minterRole = await token.read.MINTER_ROLE();

        const tokenAsAdmin = await viem.getContractAt(
            "LearningToken",
            token.address,
            { client: { wallet: admin } }
        );

        await tokenAsAdmin.write.grantRole([
            minterRole,
            minter.account.address
        ]);

        await tokenAsAdmin.write.revokeRole([
            minterRole,
            minter.account.address
        ]);

        const tokenAsMinter = await viem.getContractAt(
            "LearningToken",
            token.address,
            { client: { wallet: minter } }
        );

        await assert.rejects(
            async () => {
                await tokenAsMinter.write.mintReward([
                    learner.account.address,
                    REWARD_AMOUNT
                ]);
            }
        );

        assert.equal(
            await token.read.totalSupply(),
            0n
        );
    });
});
