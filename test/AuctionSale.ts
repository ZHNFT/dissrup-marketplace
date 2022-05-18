import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, BigNumber } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

enum TokenStandard {
  ERC721,
  ERC1155,
}

import {
  deployMarketplace,
  deployMockAsset,
  deployMockERC1155Creator,
  deployMockERC721Creator,
} from "./helpers/deploy";

import { checkTokenBalances } from "./helpers/utils";

describe("Auction Sale", function () {
  let deployer: SignerWithAddress;
  let payout: SignerWithAddress;
  let creator: SignerWithAddress;
  let collector: SignerWithAddress;
  let otherCollector: SignerWithAddress;
  let royaltyPayout: SignerWithAddress;
  let otherRoyaltyPayout: SignerWithAddress;
  let Marketplace: Contract;
  let AssetMock: Contract;
  let ERC721CreatorMock: Contract;
  let ERC1155CreatorMock: Contract;
  let UnapprovedContract: Contract;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const oneTenthOfEther: BigNumber = ethers.utils.parseEther("0.1");
  const twoTenthOfEther: BigNumber = ethers.utils.parseEther("0.2");
  const threeTenthOfEther: BigNumber = ethers.utils.parseEther("0.3");
  const ONE_DAY_IN_SECOUNDS = 24 * 60 * 60;
  describe("List", function () {
    beforeEach(async function () {
      const accounts = await ethers.getSigners();
      [deployer, payout, creator, collector] = accounts;

      Marketplace = await deployMarketplace(deployer, payout);

      AssetMock = await deployMockAsset(deployer);

      ERC721CreatorMock = await deployMockERC721Creator(creator);

      ERC1155CreatorMock = await deployMockERC1155Creator(creator);

      UnapprovedContract = await deployMockERC721Creator(creator);

      await Marketplace.connect(deployer).addContractAllowlist(
        AssetMock.address,
        TokenStandard.ERC1155
      );

      await Marketplace.connect(deployer).addContractAllowlist(
        ERC721CreatorMock.address,
        TokenStandard.ERC721
      );

      await Marketplace.connect(deployer).addContractAllowlist(
        ERC1155CreatorMock.address,
        TokenStandard.ERC1155
      );
    });

    it("can List dissrup asset for auction", async function () {
      await AssetMock.connect(deployer).mint(creator.address, 1, 1);

      await AssetMock.connect(deployer).addSaleRole(Marketplace.address);

      const receipt = Marketplace.connect(creator).listAuctionSale(
        AssetMock.address,
        0,
        1,
        ONE_DAY_IN_SECOUNDS,
        2000
      );

      await expect(receipt)
        .to.be.emit(Marketplace, "ListAuctionSale")
        .withArgs(
          AssetMock.address,
          0,
          1,
          1,
          ONE_DAY_IN_SECOUNDS,
          2000,
          creator.address
        );
    });

    it("can List Manifold ERC721 for auction", async function () {
      await ERC721CreatorMock.connect(creator).mintBaseMock(
        creator.address,
        "https://dissrup.com"
      );

      await ERC721CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );

      const receipt = Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        ONE_DAY_IN_SECOUNDS,
        2000
      );

      await expect(receipt)
        .to.be.emit(Marketplace, "ListAuctionSale")
        .withArgs(
          ERC721CreatorMock.address,
          1,
          1,
          1,
          ONE_DAY_IN_SECOUNDS,
          2000,
          creator.address
        );

      expect(
        await checkTokenBalances({
          assetContract: ERC721CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [0, 1],
        })
      ).to.be.true;
    });

    it("can List Manifold ERC1155 for auction", async function () {
      await ERC1155CreatorMock.connect(creator).mintMock(
        creator.address,
        10,
        []
      );

      await ERC1155CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );

      const receipt = Marketplace.connect(creator).listAuctionSale(
        ERC1155CreatorMock.address,
        1,
        10,
        ONE_DAY_IN_SECOUNDS,
        2000
      );

      await expect(receipt)
        .to.be.emit(Marketplace, "ListAuctionSale")
        .withArgs(
          ERC1155CreatorMock.address,
          1,
          1,
          10,
          ONE_DAY_IN_SECOUNDS,
          2000,
          creator.address
        );

      expect(
        await checkTokenBalances({
          assetContract: ERC1155CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [0, 10],
        })
      ).to.be.true;
    });

    it("can List and cancel auction", async function () {
      await ERC721CreatorMock.connect(creator).mintBaseMock(
        creator.address,
        "https://dissrup.com"
      );

      await ERC721CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );

      await Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        ONE_DAY_IN_SECOUNDS,
        2000
      );

      const receipt = Marketplace.connect(creator).cancelAuctionSale(
        ERC721CreatorMock.address,
        1,
        1
      );
      await expect(receipt)
        .to.be.emit(Marketplace, "CancelAuctionSale")
        .withArgs(ERC721CreatorMock.address, 1, 1, 1, creator.address);

      expect(
        await checkTokenBalances({
          assetContract: ERC721CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [1, 0],
        })
      ).to.be.true;
    });

    it("can List and update reserved price", async function () {
      await ERC721CreatorMock.connect(creator).mintBaseMock(
        creator.address,
        "https://dissrup.com"
      );

      await ERC721CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );
      await Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        ONE_DAY_IN_SECOUNDS,
        2000
      );

      const receipt = Marketplace.connect(creator).updateAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        1,
        ONE_DAY_IN_SECOUNDS,
        4000
      );
      await expect(receipt)
        .to.be.emit(Marketplace, "UpdateAuctionSale")
        .withArgs(
          ERC721CreatorMock.address,
          1,
          1,
          1,
          ONE_DAY_IN_SECOUNDS,
          4000
        );

      expect(
        await checkTokenBalances({
          assetContract: ERC721CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [0, 1],
        })
      ).to.be.true;
    });
    it("can list and update duraion", async function () {
      await ERC721CreatorMock.connect(creator).mintBaseMock(
        creator.address,
        "https://dissrup.com"
      );

      await ERC721CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );

      await Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        10000,
        4000
      );
      const receipt = Marketplace.connect(creator).updateAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        1,
        ONE_DAY_IN_SECOUNDS,
        4000
      );
      await expect(receipt)
        .to.be.emit(Marketplace, "UpdateAuctionSale")
        .withArgs(
          ERC721CreatorMock.address,
          1,
          1,
          1,
          ONE_DAY_IN_SECOUNDS,
          4000
        );
    });
    it("can List and add supply", async function () {
      await ERC1155CreatorMock.connect(creator).mintMock(
        creator.address,
        10,
        []
      );

      await ERC1155CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );

      await Marketplace.connect(creator).listAuctionSale(
        ERC1155CreatorMock.address,
        1,
        5,
        ONE_DAY_IN_SECOUNDS,
        2000
      );

      const receipt = Marketplace.connect(creator).updateAuctionSale(
        ERC1155CreatorMock.address,
        1,
        1,
        10,
        ONE_DAY_IN_SECOUNDS,
        2000
      );
      await expect(receipt)
        .to.be.emit(Marketplace, "UpdateAuctionSale")
        .withArgs(
          ERC1155CreatorMock.address,
          1,
          1,
          10,
          ONE_DAY_IN_SECOUNDS,
          2000
        );

      expect(
        await checkTokenBalances({
          assetContract: ERC1155CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [0, 10],
        })
      ).to.be.true;
    });

    it("can List and reduce supply", async function () {
      await ERC1155CreatorMock.connect(creator).mintMock(
        creator.address,
        10,
        []
      );

      await ERC1155CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );

      await Marketplace.connect(creator).listAuctionSale(
        ERC1155CreatorMock.address,
        1,
        5,
        ONE_DAY_IN_SECOUNDS,
        2000
      );

      const receipt = Marketplace.connect(creator).updateAuctionSale(
        ERC1155CreatorMock.address,
        1,
        1,
        5,
        ONE_DAY_IN_SECOUNDS,
        2000
      );
      await expect(receipt)
        .to.be.emit(Marketplace, "UpdateAuctionSale")
        .withArgs(
          ERC1155CreatorMock.address,
          1,
          1,
          5,
          ONE_DAY_IN_SECOUNDS,
          2000
        );

      expect(
        await checkTokenBalances({
          assetContract: ERC1155CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [5, 5],
        })
      ).to.be.true;
    });

    it("cannot list unapproved contract", async function () {
      await UnapprovedContract.connect(creator).mintBaseMock(
        creator.address,
        "https://dissrup.com"
      );

      const receipt = Marketplace.connect(creator).listAuctionSale(
        UnapprovedContract.address,
        1,
        1,
        1,
        2000
      );

      await expect(receipt).to.be.revertedWith(
        `Auction_Sale_Contract_Address_Is_Not_Approved("${UnapprovedContract.address}")`
      );

      expect(
        await checkTokenBalances({
          assetContract: UnapprovedContract,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [1, 0],
        })
      ).to.be.true;
    });

    it("cannot list with reserved price below minimum", async function () {
      await ERC721CreatorMock.connect(creator).mintBaseMock(
        creator.address,
        "https://dissrup.com"
      );

      await ERC721CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );

      const receipt = Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        ONE_DAY_IN_SECOUNDS,
        10
      );

      await expect(receipt).to.be.revertedWith("Auction_Sale_Price_Too_Low()");

      expect(
        await checkTokenBalances({
          assetContract: ERC721CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [1, 0],
        })
      ).to.be.true;
    });

    it("cannot list with amount zero", async function () {
      await ERC1155CreatorMock.connect(creator).mintMock(
        creator.address,
        1,
        []
      );

      await ERC1155CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );

      const receipt = Marketplace.connect(creator).listAuctionSale(
        ERC1155CreatorMock.address,
        1,
        0,
        ONE_DAY_IN_SECOUNDS,
        2000
      );

      await expect(receipt).to.be.revertedWith(
        "Auction_Sale_Amount_Cannot_Be_Zero()"
      );

      expect(
        await checkTokenBalances({
          assetContract: ERC1155CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [1, 0],
        })
      ).to.be.true;
    });

    it("cannot cancel Auction if not owner", async function () {
      await ERC721CreatorMock.connect(creator).mintBaseMock(
        creator.address,
        "https://dissrup.com"
      );

      await ERC721CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );

      await Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        ONE_DAY_IN_SECOUNDS,
        2000
      );

      const receipt = Marketplace.connect(collector).cancelAuctionSale(
        ERC721CreatorMock.address,
        1,
        1
      );

      await expect(receipt).to.be.revertedWith(
        "Auction_Sale_Only_Seller_Can_Cancel()"
      );

      expect(
        await checkTokenBalances({
          assetContract: ERC721CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [0, 1],
        })
      ).to.be.true;
    });

    it("cannot update auction if not owner", async function () {
      await ERC721CreatorMock.connect(creator).mintBaseMock(
        creator.address,
        "https://dissrup.com"
      );

      await ERC721CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );

      await Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        ONE_DAY_IN_SECOUNDS,
        2000
      );
      const receipt = Marketplace.connect(collector).updateAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        1,
        ONE_DAY_IN_SECOUNDS,
        4000
      );
      await expect(receipt).to.be.revertedWith(
        "Auction_Sale_Only_Seller_Can_Update()"
      );

      expect(
        await checkTokenBalances({
          assetContract: ERC721CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [0, 1],
        })
      ).to.be.true;
    });
  });

  describe("Bid", function () {
    beforeEach(async function () {
      const accounts = await ethers.getSigners();
      [deployer, payout, creator, collector, otherCollector] = accounts;

      Marketplace = await deployMarketplace(deployer, payout);

      ERC721CreatorMock = await deployMockERC721Creator(creator);

      ERC1155CreatorMock = await deployMockERC1155Creator(creator);

      await Marketplace.connect(deployer).addContractAllowlist(
        ERC721CreatorMock.address,
        TokenStandard.ERC721
      );

      await Marketplace.connect(deployer).addContractAllowlist(
        ERC1155CreatorMock.address,
        TokenStandard.ERC1155
      );

      await ERC721CreatorMock.connect(creator).mintBaseMock(
        creator.address,
        "https://dissrup.com"
      );

      await ERC721CreatorMock.connect(creator).setApprovalForAll(
        Marketplace.address,
        true
      );
    });
    it("can bid for auction", async function () {
      await Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        ONE_DAY_IN_SECOUNDS,
        2000
      );

      const receipt = Marketplace.connect(collector).bid(
        ERC721CreatorMock.address,
        1,
        1,
        { value: 2001 }
      );

      await expect(receipt)
        .to.be.emit(Marketplace, "Bid")
        .withArgs(
          ERC721CreatorMock.address,
          1,
          1,
          ZERO_ADDRESS,
          0,
          collector.address,
          2001
        );

      await expect(() => receipt).to.be.changeEtherBalances(
        [collector, Marketplace],
        [-2001, 2001]
      );
    });
    it("can outbid auction", async function () {
      await Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        1000,
        2000
      );

      let receipt = Marketplace.connect(collector).bid(
        ERC721CreatorMock.address,
        1,
        1,
        { value: ethers.utils.parseEther("0.1") }
      );
      await expect(() => receipt).to.be.changeEtherBalances(
        [collector, Marketplace],
        [ethers.utils.parseEther("-0.1"), ethers.utils.parseEther("0.1")]
      );

      receipt = Marketplace.connect(otherCollector).bid(
        ERC721CreatorMock.address,
        1,
        1,
        { value: ethers.utils.parseEther("0.2") }
      );
      await expect(receipt)
        .to.be.emit(Marketplace, "Bid")
        .withArgs(
          ERC721CreatorMock.address,
          1,
          1,
          collector.address,
          ethers.utils.parseEther("0.1"),
          otherCollector.address,
          ethers.utils.parseEther("0.2")
        );
      await expect(() => receipt).to.be.changeEtherBalances(
        [collector, otherCollector, Marketplace],
        [
          ethers.utils.parseEther("0.1"),
          ethers.utils.parseEther("-0.2"),
          ethers.utils.parseEther("0.1"),
        ]
      );
      expect(
        await checkTokenBalances({
          assetContract: ERC721CreatorMock,
          tokenId: 1,
          accounts: [creator, Marketplace],
          expectAmounts: [0, 1],
        })
      ).to.be.true;
    });

    it("can outbid with extention time", async function () {
      await Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        1000,
        2000
      );

      await Marketplace.connect(collector).bid(
        ERC721CreatorMock.address,
        1,
        1,
        { value: 2001 }
      );
    });

    it("cannot bid if seller", async function () {
      await Marketplace.connect(creator).listAuctionSale(
        ERC721CreatorMock.address,
        1,
        1,
        1000,
        2000
      );

      const receipt = Marketplace.connect(creator).bid(
        ERC721CreatorMock.address,
        1,
        1,
        { value: ethers.utils.parseEther("0.1") }
      );

      await expect(receipt).to.be.revertedWith(
        "Auction_Sale_Seller_Cannot_Bid()"
      );
    });

    it("cannot bid if msg.value lower then reserved price", async function () {
      expect(false).to.be.true;
    });

    it("cannot outbid if msg.value lower then the minimum for a bid", async function () {
      expect(false).to.be.true;
    });

    it("cannot bid if auction ended", async function () {
      expect(false).to.be.true;
    });

    it("cannot bid if not valid auction sale", async function () {
      expect(false).to.be.true;
    });
  });
});
