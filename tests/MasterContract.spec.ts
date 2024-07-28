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
            total_supply: 888,
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
        expect(jetton_data).toHaveProperty("mintable", false);
        expect(jetton_data.adminAddress).toEqualAddress(deployer.address);
        expect(jetton_data.content).toEqualCell(masterContractContent);
        console.log("content", jetton_data.content);
        expect(jetton_data.walletCode).toEqualCell(jettonWalletCode);
    });

});
