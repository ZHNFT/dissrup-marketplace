// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

abstract contract Constants {
    /**
     * @notice minmum price for sale asset.
     */
    uint256 internal constant MIN_PRICE = 100;
    /**
     * @notice the shares in manifold come in diffrant basis so need to be divided by offset (from 5000 to 50%)
     */
    uint256 internal constant MANIFOLD_ROYALTIES_BASIS_POINT = 100;
}
