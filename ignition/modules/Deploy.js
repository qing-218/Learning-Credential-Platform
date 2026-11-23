
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { keccak256, toBytes } from "viem";

const DeployModule = buildModule("LearningCredentialPlatform", (m) => {

    // 1. Deploy institution registry
    const registry = m.contract("InstitutionRegistry");

    // 2. Deploy achievement manager
    const achievementManager = m.contract("AchievementManager");

    // 3. Deploy learning token
    const learningToken = m.contract("LearningToken");

    // 4. Deploy credential NFT
    const credentialNFT = m.contract("CredentialNFT", [
        registry,
        achievementManager,
        learningToken
    ]);

    // 5. Authorize CredentialNFT to update achievement points
    m.call(
        achievementManager,
        "setCredentialContract",
        [credentialNFT]
    );

    // 6. Authorize CredentialNFT to mint LRN tokens
    const minterRole = keccak256(toBytes("MINTER_ROLE"));

    m.call(
        learningToken,
        "grantRole",
        [minterRole, credentialNFT]
    );

    return {
        registry,
        achievementManager,
        learningToken,
        credentialNFT
    };
});

export default DeployModule;
