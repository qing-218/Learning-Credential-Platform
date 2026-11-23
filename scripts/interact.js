
import { network } from "hardhat";
import { formatUnits } from "viem";

async function main() {
    const { viem } = await network.getOrCreate();

    const wallets = await viem.getWalletClients();

    const admin = wallets[0];
    const institution = wallets[1];
    const learner = wallets[2];

    // Local deployment addresses
    const REGISTRY_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const MANAGER_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    const TOKEN_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    const NFT_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

    // Connect to deployed contracts
    const registry = await viem.getContractAt(
        "InstitutionRegistry",
        REGISTRY_ADDRESS,
        { client: { wallet: admin } }
    );

    const manager = await viem.getContractAt(
        "AchievementManager",
        MANAGER_ADDRESS
    );

    const learningToken = await viem.getContractAt(
        "LearningToken",
        TOKEN_ADDRESS
    );

    const nft = await viem.getContractAt(
        "CredentialNFT",
        NFT_ADDRESS
    );

    const issuerNFT = await viem.getContractAt(
        "CredentialNFT",
        NFT_ADDRESS,
        { client: { wallet: institution } }
    );

    console.log("\n===== Learning Credential Platform =====");

    console.log("\nContract Addresses:");
    console.log("Registry:", REGISTRY_ADDRESS);
    console.log("AchievementManager:", MANAGER_ADDRESS);
    console.log("LearningToken:", TOKEN_ADDRESS);
    console.log("CredentialNFT:", NFT_ADDRESS);

    // 1. Approve institution
    console.log("\n1. Approving institution...");

    const isApproved = await registry.read.isApprovedInstitution([
        institution.account.address
    ]);

    if (!isApproved) {
        await registry.write.approveInstitution([
            institution.account.address
        ]);
    }

    console.log("Institution approved.");

    // 2. Issue credential
    console.log("\n2. Issuing credential...");

    const metadataURI =
        "ipfs://bafkreigwjrikgh3b3poq4hbmfeme42rh45ewozb4bahsf2nhjienaew3s4";

    // Get the next token ID instead of assuming it is always 1
    const tokenId = await nft.read.nextTokenId();

    // Record the learner's token balance before issuance
    const balanceBefore = await learningToken.read.balanceOf([
        learner.account.address
    ]);

    const issueHash = await issuerNFT.write.issueCredential([
        learner.account.address,
        metadataURI,
        150n
    ]);

    console.log("Transaction:", issueHash);
    console.log("Issued Token ID:", tokenId.toString());

    // 3. Query credential
    console.log("\n3. Querying credential...");

    const credential = await nft.read.getCredential([tokenId]);

    console.log("Learner:", credential[0]);
    console.log("Institution:", credential[1]);
    console.log("Points:", credential[2].toString());
    console.log("Revoked:", credential[3]);
    console.log("Metadata:", credential[5]);

    // 4. Query achievement points
    console.log("\n4. Querying learner points...");

    const points = await manager.read.achievementPoints([
        learner.account.address
    ]);

    console.log("Achievement Points:", points.toString());

    // 5. Query learner tier
    const tier = await manager.read.getLearnerTier([
        learner.account.address
    ]);

    console.log("Learner Tier:", tier);

    // 6. Query LRN reward
    console.log("\n5. Querying Learning Token rewards...");

    const balanceAfter = await learningToken.read.balanceOf([
        learner.account.address
    ]);

    const rewardReceived = balanceAfter - balanceBefore;

    console.log("LRN Balance Before:", formatUnits(balanceBefore, 18), "LRN");
    console.log("LRN Balance After:", formatUnits(balanceAfter, 18), "LRN");
    console.log("LRN Reward Received:", formatUnits(rewardReceived, 18), "LRN");

    // 7. Verify credential
    console.log("\n6. Verifying credential...");

    const validBefore = await nft.read.isCredentialValid([tokenId]);

    console.log("Valid before revocation:", validBefore);

    // 8. Revoke credential
    console.log("\n7. Revoking credential...");

    const revokeHash = await issuerNFT.write.revokeCredential([
        tokenId,
        "Demonstration of credential revocation"
    ]);

    console.log("Revocation transaction:", revokeHash);

    // 9. Verify credential again
    console.log("\n8. Verifying credential after revocation...");

    const validAfter = await nft.read.isCredentialValid([tokenId]);

    console.log("Valid after revocation:", validAfter);

    // 10. Query updated points and tier
    console.log("\n9. Querying updated achievement points...");

    const updatedPoints = await manager.read.achievementPoints([
        learner.account.address
    ]);

    const updatedTier = await manager.read.getLearnerTier([
        learner.account.address
    ]);

    console.log("Updated Points:", updatedPoints.toString());
    console.log("Updated Tier:", updatedTier);

    // 11. Verify LRN rewards are preserved after revocation
    console.log("\n10. Checking LRN balance after revocation...");

    const balanceAfterRevocation = await learningToken.read.balanceOf([
        learner.account.address
    ]);

    console.log(
        "LRN Balance After Revocation:",
        formatUnits(balanceAfterRevocation, 18),
        "LRN"
    );

    console.log(
        "LRN Reward Preserved:",
        balanceAfterRevocation === balanceAfter
    );

    console.log("\n===== Demonstration Completed =====");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
