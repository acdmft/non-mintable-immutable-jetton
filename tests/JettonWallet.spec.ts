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

    let deployerJWalletAddress: Address;
    let nonDeployerJwalletAddr: Address;
    let deployerJettonWallet: SandboxContract<JettonWallet>;
    let nonDeployerJettonWallet: SandboxContract<JettonWallet>;

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
        // DEPLOYER
        deployerJWalletAddress = await masterContract.getWalletAddress(deployer.address);
        deployerJettonWallet = blockchain.openContract(JettonWallet.createFromAddress(deployerJWalletAddress));
        // NON DEPLOYER 
        nonDeployerJwalletAddr = await masterContract.getWalletAddress(nonDeployer.address);
        nonDeployerJettonWallet = await blockchain.openContract(
            JettonWallet.createFromAddress(nonDeployerJwalletAddr)
        );
        // MINTING JETTONS
        const mintResult = await masterContract.sendMint(
            deployer.getSender(),
            deployer.address,
            BigInt(100500),
            toNano('0.01'), // forward ton amount
            toNano('1') // total ton amount
        );
        
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
        expect(jwallet_data.jetton_balance).toBe(BigInt(100500));
        expect(jwallet_data.owner_address).toEqualAddress(deployer.address);
        expect(jwallet_data.minter_address).toEqualAddress(masterContract.address);
        expect(jwallet_data.jwallet_code).toEqualCell(jettonWalletCode);
    });

    it('wallet owner should be able to send jettons', async () => {
        let deployerJettonBalance = await deployerJettonWallet.getJettonBalance();
        expect(deployerJettonBalance).toBe(BigInt(100500));
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
        expect(sendResult.transactions).toHaveTransaction({
            to: deployerJettonWallet.address,
            op: Op.transfer,
            from: deployer.address,
            success: true 
        });
        let newdeployerJettonBalance = await deployerJettonWallet.getJettonBalance();
        // console.log('new jettonWalletBalance ', deployerJettonBalance);
        expect(newdeployerJettonBalance).toBe(deployerJettonBalance - BigInt(100));
    });

    it('no-wallet owner should not be able to send jettons', async () => {
        const sendResult = await deployerJettonWallet.sendTransfer(
            nonDeployer.getSender(), 
            toNano('0.1'), 
            BigInt(100), // jetton_amount toNano('0.0000005'),
            nonDeployer.address,
            deployer.address,
            beginCell().endCell(), // custom payload
            toNano('0'), // forward ton amount
            beginCell().endCell() 
        )
        expect(sendResult.transactions).toHaveTransaction({
            to: deployerJettonWallet.address,
            from: nonDeployer.address,
            op: Op.transfer,
            success: false,
            exitCode: 705 
        });
    });

    it("impossible to send too much jettons", async () => {
        const initialJettonBalance = await deployerJettonWallet.getJettonBalance();
        const sendResult = await deployerJettonWallet.sendTransfer(
            deployer.getSender(), 
            toNano('0.1'), 
            (initialJettonBalance + 50n), // jetton_amount toNano('0.0000005'),
            nonDeployer.address,
            deployer.address,
            beginCell().endCell(), // custom payload
            toNano('0'), // forward ton amount
            beginCell().endCell() 
        );
        expect(sendResult.transactions).toHaveTransaction({
            to: deployerJettonWallet.address,
            from: deployer.address,
            op: Op.transfer,
            success: false,
            exitCode: 706
        })
    });

    it('malformed forward payload', async () => {

    });
});
