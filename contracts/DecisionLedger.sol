// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Fuji üzerinde kararın küçük, doğrulanabilir özetini tutar.
contract DecisionLedger {
    event DecisionRecorded(
        bytes32 indexed decisionHash,
        string decision,
        uint256 globalBtcUsdtE8,
        uint256 usdtTryE8,
        uint256 trBtcTryAskE8,
        int256 premiumBps,
        uint256 observedAt,
        uint256 recordedAt
    );

    function record(
        bytes32 decisionHash,
        string calldata decision,
        uint256 globalBtcUsdtE8,
        uint256 usdtTryE8,
        uint256 trBtcTryAskE8,
        int256 premiumBps,
        uint256 observedAt
    ) external {
        require(bytes(decision).length > 0, "decision required");
        require(decisionHash != bytes32(0), "hash required");
        emit DecisionRecorded(
            decisionHash,
            decision,
            globalBtcUsdtE8,
            usdtTryE8,
            trBtcTryAskE8,
            premiumBps,
            observedAt,
            block.timestamp
        );
    }
}
