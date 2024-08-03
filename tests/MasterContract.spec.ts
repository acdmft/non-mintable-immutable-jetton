import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { MasterContract } from '../wrappers/MasterContract';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import * as dotenv from 'dotenv';
import { buildMasterContentCell } from '../scripts/jettonContent/onChain';
import { JettonWallet } from '@ton/ton';
dotenv.config();

describe('MasterContract', () => {
    let masterContractCode: Cell;
    let jettonWalletCode: Cell;
    let masterContractContent: Cell;

    beforeAll(async () => {
        jettonWalletCode = await compile("JettonWallet");
        masterContractCode = await compile('MasterContract');
        
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let masterContract: SandboxContract<MasterContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        masterContractContent = buildMasterContentCell({
            name: process.env.JETTON_NAME!,
            description: process.env.JETTON_DESCRIPTION!,
            symbol: process.env.JETTON_SYMBOL!,
            decimals: parseInt(process.env.JETTON_PRECISION!),
            image: process.env.JETTON_IMG_URL!
       
        });
        // const deployer = await blockchain.treasury('deployer');

        masterContract = blockchain.openContract(MasterContract.createFromConfig({
            total_supply: parseInt(process.env.JETTON_SUPPLY!),
            mintable: -1,
            admin: deployer.address!,
            content: masterContractContent,
            jetton_wallet: jettonWalletCode 
        }, masterContractCode));


        const deployResult = await masterContract.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterContract.address,
            deploy: true,
            success: true,
        });
    });

    it('should get jetton data after contract has been deployed', async () => {
        // the check is done inside beforeEach
        // blockchain and masterContract are ready to use
        const jetton_data = await masterContract.getJettonData();
        expect(jetton_data).toHaveProperty("totalSupply", BigInt(parseInt(process.env.JETTON_SUPPLY!)));
        expect(jetton_data).toHaveProperty("mintable", true);
        expect(jetton_data.adminAddress).toEqualAddress(deployer.address);
        expect(jetton_data.content).toEqualCell(masterContractContent);
        // console.log("content", jetton_data.content);
        expect(jetton_data.walletCode).toEqualCell(jettonWalletCode);
    });

    it('should allow to change admin address', async () => {
        const new_owner = await blockchain.treasury('new_owner');
        const result = await masterContract.sendChangeAdmin(deployer.getSender(), new_owner.address);
        const jetton_data = await masterContract.getJettonData();
        expect(jetton_data.adminAddress).toEqualAddress(new_owner.address);
        // console.log('result', result)
    });

    it('admin should be able to mint jettons one time', async() => {
        const jetton_owner = await blockchain.treasury('jetton_owner');
        const jwallet_address = await masterContract.getWalletAddress(jetton_owner.address);
        const initialJettonBalance = await masterContract.getJettonBalance();
        console.log('initialJettonBalance', initialJettonBalance);
        const mintResult = await masterContract.sendMint(deployer.getSender(), {
            toAddress: jwallet_address,
            jettonAmount: BigInt(process.env.JETTON_SUPPLY!),
            amount: toNano('0.05'),
            queryId: 0,
            value: toNano('0.04')
        })
        // console.log('mintResult ', mintResult.transactions);
        const newJettonBalance = await masterContract.getJettonBalance();
        // ADDITIONAL MINT ATTEMPT
        expect(newJettonBalance).toBe(initialJettonBalance + BigInt(process.env.JETTON_SUPPLY!));
        const additionalMintAttempt = await masterContract.sendMint(deployer.getSender(), {
            toAddress: jwallet_address,
            jettonAmount: BigInt(process.env.JETTON_SUPPLY!),
            amount: toNano('0.05'),
            queryId: 0,
            value: toNano('0.04')
        });
        expect(additionalMintAttempt.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterContract.address,
            success: false,
            exitCode: 101
        })
    });

    it('not minter admin should not be able to mint jettons', async () => {
        const non_owner_wallet = await blockchain.treasury('non-owner');
        const jwallet_address = await masterContract.getWalletAddress(non_owner_wallet.address);

        const mintResult = await masterContract.sendMint(non_owner_wallet.getSender(), {
            toAddress: jwallet_address,
            jettonAmount: BigInt(process.env.JETTON_SUPPLY!),
            amount: toNano('0.05'),
            queryId: 0,
            value: toNano('0.04')
        });

        expect(mintResult.transactions).toHaveTransaction({
            from: non_owner_wallet.address,
            to: masterContract.address,
            success: false,
            exitCode: 73
        })
    })
});
