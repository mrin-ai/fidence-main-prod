// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PAYAGENTOracle is Ownable {
    uint256 private _price = 100000000; // $1.00 (8 decimals)

    constructor(address initialOwner) Ownable(initialOwner) {}

    function latestPrice() external view returns (uint256) {
        return _price;
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Invalid price");
        _price = newPrice;
    }
}