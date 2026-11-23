
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("InstitutionRegistry", async function () {

    const { viem } = await network.connect();

    const publicClient = await viem.getPublicClient();
    const wallets = await viem.getWalletClients();

    const admin = wallets[0];
    const institutionA = wallets[1];
    const institutionB = wallets[2];
    const user = wallets[3];

    async function deployRegistry() {
        return await viem.deployContract("InstitutionRegistry");
    }

    it("Should assign administrator role to deployer", async function () {
        const registry = await deployRegistry();

        const adminRole = await registry.read.DEFAULT_ADMIN_ROLE();

        const result = await registry.read.hasRole([
            adminRole,
            admin.account.address
        ]);

        assert.equal(result, true);
    });

    it("Should approve an institution", async function () {
        const registry = await deployRegistry();

        await registry.write.approveInstitution([
            institutionA.account.address
        ]);

        const approved = await registry.read.isApprovedInstitution([
            institutionA.account.address
        ]);

        assert.equal(approved, true);
    });

    it("Should reject zero address", async function () {
        const registry = await deployRegistry();

        await assert.rejects(async () => {
            await registry.write.approveInstitution([
                "0x0000000000000000000000000000000000000000"
            ]);
        });
    });

    it("Should reject duplicate institution approval", async function () {
        const registry = await deployRegistry();

        await registry.write.approveInstitution([
            institutionA.account.address
        ]);

        await assert.rejects(async () => {
            await registry.write.approveInstitution([
                institutionA.account.address
            ]);
        });
    });

    it("Should reject unauthorized approval", async function () {
        const registry = await deployRegistry();

        const unauthorizedRegistry =
            await viem.getContractAt(
                "InstitutionRegistry",
                registry.address,
                { client: { wallet: user } }
            );

        await assert.rejects(async () => {
            await unauthorizedRegistry.write.approveInstitution([
                institutionA.account.address
            ]);
        });
    });

    it("Should remove an approved institution", async function () {
        const registry = await deployRegistry();

        await registry.write.approveInstitution([
            institutionA.account.address
        ]);

        await registry.write.removeInstitution([
            institutionA.account.address
        ]);

        const approved = await registry.read.isApprovedInstitution([
            institutionA.account.address
        ]);

        assert.equal(approved, false);
    });

    it("Should reject removal of an unapproved institution", async function () {
        const registry = await deployRegistry();

        await assert.rejects(async () => {
            await registry.write.removeInstitution([
                institutionB.account.address
            ]);
        });
    });
});
