import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, beginCell, Address } from '@ton/core';
import { JettonWallet } from '../wrappers/JettonWallet';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { MasterContract } from '../wrappers/MasterContract';
import { buildMasterContentCell } from '../scripts/jettonContent/onChain';
import * as dotenv from 'dotenv';
dotenv.config();

describe('JettonWallet', () => {
    let masterContractCode: Cell;
    let jettonWalletCode: Cell;
    let masterContractContent: Cell;

    beforeAll(async () => {
        jettonWalletCode = await compile('JettonWallet');
        masterContractCode = await compile('MasterContract');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let jettonContract: any; //SandboxContract<TreasuryContract>;
    let masterContract: SandboxContract<MasterContract>;
    let jettonWalletContract: SandboxContract<JettonWallet>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        masterContractContent = buildMasterContentCell({
            name: process.env.JETTON_NAME!,
            description: process.env.JETTON_DESCRIPTION!,
            symbol: process.env.JETTON_SYMBOL!,
            decimals: parseInt(process.env.JETTON_PRECISION!),
            image: process.env.JETTON_IMG_URL!,
        });
        // const deployer = await blockchain.treasury('deployer');

        masterContract = blockchain.openContract(
            MasterContract.createFromConfig(
                {
                    total_supply: 888,
                    admin: deployer.address!,
                    content: masterContractContent,
                    jetton_wallet: jettonWalletCode,
                },
                masterContractCode,
            ),
        );
    });

    it('should deploy minter contract', async () => {
        const deployResult = await masterContract.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterContract.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy jetton wallet contract', async () => {
        const deployResult = await masterContract.sendDeploy(deployer.getSender(), toNano('0.05'));
        jettonContract = blockchain.openContract(
            JettonWallet.createFromConfig(
                {
                    ownerAddress: deployer.address,
                    minterAddress: masterContract.address,
                    walletCode: jettonWalletCode,
                },
                jettonWalletCode,
            ),
        );
        
        console.log('jettonContract', jettonContract);
        console.log('masterContract', masterContract.address);
        expect(true).toBe(true);
        const jettonContractDeployResult = await jettonContract.sendDeploy(deployer.getSender(), toNano('1'));
        expect(jettonContractDeployResult.transactions).toHaveTransaction({
            from: deployer.address,
            value: toNano("1"),
            to: jettonContract.address,
            deploy: true,
        });
        const jettonWalletAddress = await masterContract.getWalletAddress(deployer.address);
        expect(jettonWalletAddress).toEqualAddress(jettonContract.address);
    });
});
