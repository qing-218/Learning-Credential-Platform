
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("AchievementManager", async function () {

    const { viem } = await network.connect();

    const wallets = await viem.getWalletClients();

    const admin = wallets[0];
    const learner = wallets[1];
    const nftAddress = wallets[2];

    async function deployManager() {
        return await viem.deployContract("AchievementManager");
    }

    async function setupManager() {
        const manager = await deployManager();

        await manager.write.setCredentialContract([
            nftAddress.account.address
        ]);

        return manager;
    }

    it("Should calculate Bronze tier", async function () {
        const manager = await deployManager();

        assert.equal(
            await manager.read.calculateTier([99n]),
            0
        );
    });

    it("Should calculate Silver tier", async function () {
        const manager = await deployManager();

        assert.equal(
            await manager.read.calculateTier([100n]),
            1
        );

        assert.equal(
            await manager.read.calculateTier([299n]),
            1
        );
    });

    it("Should calculate Gold tier", async function () {
        const manager = await deployManager();

        assert.equal(
            await manager.read.calculateTier([300n]),
            2
        );

        assert.equal(
            await manager.read.calculateTier([599n]),
            2
        );
    });

    it("Should calculate Platinum tier", async function () {
        const manager = await deployManager();

        assert.equal(
            await manager.read.calculateTier([600n]),
            3
        );
    });

    it("Should reject unauthorized point updates", async function () {
        const manager = await setupManager();

        const unauthorizedManager =
            await viem.getContractAt(
                "AchievementManager",
                manager.address,
                { client: { wallet: learner } }
            );

        await assert.rejects(async () => {
            await unauthorizedManager.write.updatePoints([
                learner.account.address,
                150n,
                true
            ]);
        });
    });

    it("Should increase learner points", async function () {
        const manager = await setupManager();

        const nftManager = await viem.getContractAt(
            "AchievementManager",
            manager.address,
            { client: { wallet: nftAddress } }
        );

        await nftManager.write.updatePoints([
            learner.account.address,
            150n,
            true
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

    it("Should deduct points after credential revocation", async function () {
        const manager = await setupManager();

        const nftManager = await viem.getContractAt(
            "AchievementManager",
            manager.address,
            { client: { wallet: nftAddress } }
        );

        await nftManager.write.updatePoints([
            learner.account.address,
            300n,
            true
        ]);

        await nftManager.write.updatePoints([
            learner.account.address,
            150n,
            false
        ]);

        const points = await manager.read.achievementPoints([
            learner.account.address
        ]);

        assert.equal(points, 150n);
    });

    it("Should reject point deduction exceeding balance", async function () {
        const manager = await setupManager();

        const nftManager = await viem.getContractAt(
            "AchievementManager",
            manager.address,
            { client: { wallet: nftAddress } }
        );

        await assert.rejects(async () => {
            await nftManager.write.updatePoints([
                learner.account.address,
                100n,
                false
            ]);
        });
    });
});
