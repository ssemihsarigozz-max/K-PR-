// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Fuji üzerinde yalnızca karar özeti tutar; fiyat ve kullanıcı verisi tutmaz.
contract DecisionLedger {
    event DecisionRecorded(bytes32 indexed decisionHash, string decision, uint256 timestamp);

    function record(bytes32 decisionHash, string calldata decision) external {
        require(bytes(decision).length > 0, "decision required");
        emit DecisionRecorded(decisionHash, decision, block.timestamp);
    }
}
