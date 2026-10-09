// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";

/// @notice Permissionless meta-transaction forwarder. Anyone may submit a user-signed request
/// and pay the gas; the signature, nonce and deadline are checked here.
contract FamFiForwarder is ERC2771Forwarder {
    constructor() ERC2771Forwarder("FamFiForwarder") {}
}
