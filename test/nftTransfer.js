const Wallet = require("../build/BaseWallet");
const Registry = require("../build/ModuleRegistry");

const GuardianStorage = require("../build/GuardianStorage");
const NftModule = require("../build/NftTransfer");

const ERC721 = require("../build/TestERC721");
const CK = require("../build/CryptoKittyTest");

const ZERO_BYTES32 = ethers.constants.HashZero;

const TestManager = require("../utils/test-manager");

describe("Test Token Transfer", function () {
    this.timeout(10000);

    const manager = new TestManager(accounts);

    const owner1 = accounts[1].signer;
    const owner2 = accounts[2].signer;
    const eoaRecipient = accounts[3].signer;

    let nftModule, wallet1, wallet2, erc721, ck, ckId;

    const tokenId = 1;


    before(async () => {
        deployer = manager.newDeployer();
        const registry = await deployer.deploy(Registry);

        const guardianStorage = await deployer.deploy(GuardianStorage);
        ck = await deployer.deploy(CK);
        nftModule = await deployer.deploy(NftModule, {},
            registry.contractAddress,
            guardianStorage.contractAddress,
            ck.contractAddress
        );
    });

    beforeEach(async () => {
        wallet1 = await deployer.deploy(Wallet);
        wallet2 = await deployer.deploy(Wallet);
        await wallet1.init(owner1.address, [nftModule.contractAddress]);
        await wallet2.init(owner2.address, [nftModule.contractAddress]);
        erc721 = await deployer.deploy(ERC721);
        await erc721.mint(wallet1.contractAddress, tokenId);
    });


    describe("NFT transfers", () => {
        async function testNftTransfer({ safe = true, relayed, recipientAddress, nftContract = erc721, nftId = tokenId }) {
            let beforeWallet1 = await nftContract.balanceOf(wallet1.contractAddress);
            let beforeRecipient = await nftContract.balanceOf(recipientAddress);
            if (relayed) {
                await manager.relay(nftModule, 'transferNFT', [wallet1.contractAddress, nftContract.contractAddress, recipientAddress, nftId, safe, ZERO_BYTES32], wallet1, [owner1]);
            } else {
                await nftModule.from(owner1).transferNFT(wallet1.contractAddress, nftContract.contractAddress, recipientAddress, nftId, safe, ZERO_BYTES32);
            }
            let afterWallet1 = await nftContract.balanceOf(wallet1.contractAddress);
            let afterRecipient = await nftContract.balanceOf(recipientAddress);
            assert.equal(beforeWallet1.sub(afterWallet1).toNumber(), 1, `wallet1 should have one less NFT (safe: ${safe}, relayed: ${relayed})`);
            assert.equal(afterRecipient.sub(beforeRecipient).toNumber(), 1, `recipient should have one more NFT (safe: ${safe}, relayed: ${relayed})`);
        }

        describe("transfer to EOA account", () => {
            it('should allow unsafe NFT transfer from wallet1 to an EOA account', async () => {
                await testNftTransfer({ safe: false, relayed: false, recipientAddress: eoaRecipient.address });
            });

            it('should allow safe NFT transfer from wallet1 to an EOA account', async () => {
                await testNftTransfer({ safe: true, relayed: false, recipientAddress: eoaRecipient.address });
            });


            it('should allow unsafe NFT transfer from wallet1 to an EOA account (relayed)', async () => {
                await testNftTransfer({ safe: false, relayed: true, recipientAddress: eoaRecipient.address });
            });

            it('should allow safe NFT transfer from wallet1 to an EOA account (relayed)', async () => {
                await testNftTransfer({ safe: true, relayed: true, recipientAddress: eoaRecipient.address });
            });
        });

        describe("transfer to other wallet", () => {
            it('should allow unsafe NFT transfer from wallet1 to wallet2', async () => {
                await testNftTransfer({ safe: false, relayed: false, recipientAddress: wallet2.contractAddress });
            });

            it('should allow safe NFT transfer from wallet1 to wallet2', async () => {
                await testNftTransfer({ safe: true, relayed: false, recipientAddress: wallet2.contractAddress });
            });

            it('should allow unsafe NFT transfer from wallet1 to wallet2 (relayed)', async () => {
                await testNftTransfer({ safe: false, relayed: true, recipientAddress: wallet2.contractAddress });
            });

            it('should allow safe NFT transfer from wallet1 to wallet2 (relayed)', async () => {
                await testNftTransfer({ safe: true, relayed: true, recipientAddress: wallet2.contractAddress });
            });
        });

        describe("CK transfer", () => {
            beforeEach(async () => {
                await ck.createDumbKitty(wallet1.contractAddress);
                ckId = (ckId === undefined) ? 0 : ckId + 1; // update the id of the CryptoKitty that was just created
            });

            it('should allow CK transfer from wallet1 to wallet2', async () => {
                await testNftTransfer({ relayed: false, nftId: ckId, nftContract: ck, recipientAddress: wallet2.contractAddress });
            });

            it('should allow CK transfer from wallet1 to wallet2 (relayed)', async () => {
                await testNftTransfer({ relayed: true, nftId: ckId, nftContract: ck, recipientAddress: wallet2.contractAddress });
            });

            it('should allow CK transfer from wallet1 to EOA account', async () => {
                await testNftTransfer({ relayed: false, nftId: ckId, nftContract: ck, recipientAddress: eoaRecipient.address });
            });

            it('should allow CK transfer from wallet1 to EOA account (relayed)', async () => {
                await testNftTransfer({ relayed: true, nftId: ckId, nftContract: ck, recipientAddress: eoaRecipient.address });
            });

        });
    });

});