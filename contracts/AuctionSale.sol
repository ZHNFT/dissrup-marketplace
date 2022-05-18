// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import {Constants} from "./Constants.sol";

import {Core} from "./Core.sol";

import {Payment} from "./Payment.sol";

error Auction_Sale_Contract_Address_Is_Not_Approved(address nftAddress);

error Auction_Sale_Amount_Cannot_Be_Zero();

error Auction_Sale_Price_Too_Low();

error Cannot_Update_Ongoing_Auction();

error Auction_Sale_Only_Seller_Can_Update();

error Cannot_Cancel_Ongoing_Auction();

error Auction_Sale_Only_Seller_Can_Cancel();

error Auction_Sale_Not_A_Valid_List();

error Auction_Sale_Already_Ended();

error Auction_Sale_Msg_Value_Lower_Then_Reserve_Price();

error Auction_Sale_Bid_Must_Be_Greater_Then(uint256 minimumBid);

error Auction_Sale_Seller_Cannot_Bid();

abstract contract AuctionSale is Constants, Core, Payment {
    struct AuctionSaleList {
        uint256 duration;
        uint256 extensionDuration;
        uint256 endTime;
        address bidder;
        uint256 bid;
        uint256 reservePrice;
        uint256 amount;
        address seller;
    }

    uint256 internal _auctionSaleId;

    mapping(address => mapping(uint256 => mapping(uint256 => AuctionSaleList)))
        internal assetAndSaleIdToAuctionSale;

    event ListAuctionSale(
        address nftAddress,
        uint256 tokenId,
        uint256 saleId,
        uint256 amount,
        uint256 duration,
        uint256 reservePrice,
        address seller
    );
    event CancelAuctionSale(
        address nftAddress,
        uint256 tokenId,
        uint256 saleId,
        uint256 amount,
        address seller
    );
    event UpdateAuctionSale(
        address nftAddress,
        uint256 tokenId,
        uint256 saleId,
        uint256 amount,
        uint256 duration,
        uint256 reservePrice
    );
    event Bid(
        address nftAddress,
        uint256 tokenId,
        uint256 saleId,
        address lastBidder,
        uint256 lastBid,
        address newBidder,
        uint256 newBid
    );

    function listAuctionSale(
        address nftAddress,
        uint256 tokenId,
        uint256 amount,
        uint256 duration,
        uint256 reservePrice
    ) external {
        if (_saleContractAllowlist[nftAddress] == false) {
            revert Auction_Sale_Contract_Address_Is_Not_Approved(nftAddress);
        }
        if (reservePrice < MIN_PRICE) {
            revert Auction_Sale_Price_Too_Low();
        }
        if (amount == 0) {
            revert Auction_Sale_Amount_Cannot_Be_Zero();
        }
        _trasferNFT(msg.sender, address(this), nftAddress, tokenId, amount);
        AuctionSaleList storage auctionSale = assetAndSaleIdToAuctionSale[
            nftAddress
        ][tokenId][++_auctionSaleId];
        auctionSale.amount = amount;
        auctionSale.bidder = address(0);
        auctionSale.bid = 0;
        auctionSale.endTime = 0;
        auctionSale.extensionDuration = EXTENSION_DURATION;
        auctionSale.duration = duration;
        auctionSale.reservePrice = reservePrice;
        auctionSale.seller = msg.sender;
        emit ListAuctionSale(
            nftAddress,
            tokenId,
            _auctionSaleId,
            auctionSale.amount,
            auctionSale.duration,
            auctionSale.reservePrice,
            auctionSale.seller
        );
    }

    function updateAuctionSale(
        address nftAddress,
        uint256 tokenId,
        uint256 saleId,
        uint256 amount,
        uint256 duration,
        uint256 reservePrice
    ) external {
        if (reservePrice < MIN_PRICE) {
            revert Auction_Sale_Price_Too_Low();
        }
        if (amount == 0) {
            revert Auction_Sale_Amount_Cannot_Be_Zero();
        }
        AuctionSaleList storage auctionSale = assetAndSaleIdToAuctionSale[
            nftAddress
        ][tokenId][saleId];

        if (auctionSale.seller != msg.sender) {
            revert Auction_Sale_Only_Seller_Can_Update();
        }

        if (auctionSale.endTime != 0) {
            revert Cannot_Update_Ongoing_Auction();
        }

        auctionSale.reservePrice = reservePrice;

        if (amount > auctionSale.amount) {
            uint256 reducedAmount = amount - auctionSale.amount;
            _trasferNFT(
                msg.sender,
                address(this),
                nftAddress,
                tokenId,
                reducedAmount
            );
        }

        if (amount < auctionSale.amount) {
            uint256 addAmount = auctionSale.amount - amount;
            _trasferNFT(
                msg.sender,
                address(this),
                nftAddress,
                tokenId,
                addAmount
            );
        }
        auctionSale.duration = duration;

        emit UpdateAuctionSale(
            nftAddress,
            tokenId,
            saleId,
            amount,
            auctionSale.duration,
            reservePrice
        );
    }

    function cancelAuctionSale(
        address nftAddress,
        uint256 tokenId,
        uint256 saleId
    ) external {
        AuctionSaleList memory auctionSale = assetAndSaleIdToAuctionSale[
            nftAddress
        ][tokenId][saleId];
        if (auctionSale.seller != msg.sender) {
            revert Auction_Sale_Only_Seller_Can_Cancel();
        }
        if (auctionSale.endTime != 0) {
            revert Cannot_Cancel_Ongoing_Auction();
        }
        _trasferNFT(
            address(this),
            auctionSale.seller,
            nftAddress,
            tokenId,
            auctionSale.amount
        );

        delete assetAndSaleIdToAuctionSale[nftAddress][tokenId][saleId];

        emit CancelAuctionSale(
            nftAddress,
            tokenId,
            saleId,
            auctionSale.amount,
            auctionSale.seller
        );
    }

    function bid(
        address nftAddress,
        uint256 tokenId,
        uint256 saleId
    ) external payable {
        AuctionSaleList storage auctionSale = assetAndSaleIdToAuctionSale[
            nftAddress
        ][tokenId][saleId];
        address lastBidder;
        uint256 lastBid;
        if (auctionSale.seller == address(0)) {
            revert Auction_Sale_Not_A_Valid_List();
        }

        if (auctionSale.endTime > 0 && auctionSale.endTime < block.timestamp) {
            revert Auction_Sale_Already_Ended();
        }
        if (msg.sender == auctionSale.seller) {
            revert Auction_Sale_Seller_Cannot_Bid();
        }
        if (auctionSale.bidder == address(0)) {
            //first bid!
            if (msg.value <= auctionSale.reservePrice) {
                revert Auction_Sale_Msg_Value_Lower_Then_Reserve_Price();
            }

            auctionSale.bidder = msg.sender;
            auctionSale.bid = msg.value;

            auctionSale.endTime =
                uint256(block.timestamp) +
                auctionSale.duration;
        } else {
            // not the fisrt bid
            uint256 minimumRasieForBid = _getMinBidForReserveAuction(
                auctionSale.bid
            );

            if (minimumRasieForBid > msg.value) {
                revert Auction_Sale_Bid_Must_Be_Greater_Then(
                    minimumRasieForBid
                );
            }
            if (
                auctionSale.endTime - block.timestamp <
                auctionSale.extensionDuration
            ) {
                auctionSale.endTime += auctionSale.extensionDuration;
            }

            lastBidder = auctionSale.bidder;
            lastBid = auctionSale.bid;
            // return ether to last bidder
            payable(lastBidder).transfer(lastBid);

            //
            auctionSale.bidder = msg.sender;
            auctionSale.bid = msg.value;
        }

        emit Bid(
            nftAddress,
            tokenId,
            saleId,
            lastBidder,
            lastBid,
            auctionSale.bidder,
            auctionSale.bid
        );
    }

    function _getMinBidForReserveAuction(uint256 currentBid)
        internal
        pure
        returns (uint256)
    {
        uint256 minimumIncrement = currentBid / 10;

        if (minimumIncrement < (0.1 ether)) {
            // The next bid must be at least 0.1 ether greater than the current.
            return currentBid + (0.1 ether);
        }
        return (currentBid + minimumIncrement);
    }
}
