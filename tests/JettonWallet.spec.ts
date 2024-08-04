import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano, beginCell, Address } from '@ton/core';
import { JettonWallet } from '../wrappers/JettonWallet';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { MasterContract } from '../wrappers/MasterContract';
import { buildMasterContentCell } from '../scripts/jettonContent/onChain';
import { Op } from '../wrappers/JettonConstants';
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
    let nonDeployer: SandboxContract<TreasuryContract>;
    let jettonContract: any; //SandboxContract<TreasuryContract>;
    let masterContract: SandboxContract<MasterContract>;
    // let jettonWalletContract: SandboxContract<JettonWallet>;
    let minterContractDeployRes: any;
    let jettonContractDeployRes: any;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        nonDeployer = await blockchain.treasury('non-deployer');

        masterContractContent = buildMasterContentCell({
            name: process.env.JETTON_NAME!,
            description: process.env.JETTON_DESCRIPTION!,
            symbol: process.env.JETTON_SYMBOL!,
            decimals: parseInt(process.env.JETTON_PRECISION!),
            image: process.env.JETTON_IMG_URL!,
        });

        masterContract = blockchain.openContract(
            MasterContract.createFromConfig(
                {
                    total_supply: 888,
                    mintable: -1,
                    admin: deployer.address!,
                    content: masterContractContent,
                    jetton_wallet: jettonWalletCode,
                },
                masterContractCode,
            ),
        );

        minterContractDeployRes = await masterContract.sendDeploy(deployer.getSender(), toNano('0.05'));
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

        jettonContractDeployRes = await jettonContract.sendDeploy(deployer.getSender(), toNano('1'));

    });

    it('should deploy minter contract', async () => {
        expect(minterContractDeployRes.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterContract.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy jetton wallet contract', async () => {
        expect(jettonContractDeployRes.transactions).toHaveTransaction({
            from: deployer.address,
            value: toNano("1"),
            to: jettonContract.address,
            deploy: true,
        });
        const jettonWalletAddress = await masterContract.getWalletAddress(deployer.address);
        expect(jettonWalletAddress).toEqualAddress(jettonContract.address);
    });
    it ('should get jetton wallet data after contract has been deployed', async () => {
        let initialJettonBalance = await jettonContract.getJettonBalance();
        console.log('initialJettonBalance ', initialJettonBalance);
        let jwallet_data = await jettonContract.getJettoWalletData();
        // console.log('jwallet_data', jwallet_data);
        expect(jwallet_data.jetton_balance).toBe(toNano(0));
        expect(jwallet_data.owner_address).toEqualAddress(deployer.address);
        expect(jwallet_data.minter_address).toEqualAddress(masterContract.address);
        expect(jwallet_data.jwallet_code).toEqualCell(jettonWalletCode);
    });

    it('wallet owner should be able to send jettons', async () => {
        const jwallet_address = await masterContract.getWalletAddress(deployer.address);
        const deployerJettonWallet = blockchain.openContract(JettonWallet.createFromAddress(jwallet_address))
        const mintResult = await masterContract.sendMint(
            deployer.getSender(),
            deployer.address,
            BigInt(100500),
            toNano('0.01'), // forward ton amount
            toNano('1') // total ton amount
        );
        let deployerJettonBalance = await deployerJettonWallet.getJettonBalance();
        expect(deployerJettonBalance).toBe(BigInt(100500));
        // console.log('initial deployerJettonBalance ', deployerJettonBalance);
        const nonDeployerJwalletAddr = await masterContract.getWalletAddress(nonDeployer.address);
        const nonDeployerJettonWallet = await blockchain.openContract(
            JettonWallet.createFromAddress(nonDeployerJwalletAddr)
        )
        const sendResult = await deployerJettonWallet.sendTransfer(
            deployer.getSender(), 
            toNano('0.1'), 
            BigInt(100), // jetton_amount toNano('0.0000005'),
            nonDeployer.address,
            deployer.address,
            beginCell().endCell(), // custom payload
            toNano('0'), // forward ton amount
            beginCell().endCell() // forward payload
        )
        expect(sendResult.transactions).toHaveTransaction({ //excesses
            to: deployerJettonWallet.address,
            op: Op.transfer,
            from: deployer.address,
            success: true 
        });
        deployerJettonBalance = await deployerJettonWallet.getJettonBalance();
        // console.log('new jettonWalletBalance ', deployerJettonBalance);
    })

});
