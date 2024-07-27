import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { MasterContract } from '../wrappers/MasterContract';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('MasterContract', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('MasterContract');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let masterContract: SandboxContract<MasterContract>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        masterContract = blockchain.openContract(MasterContract.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await masterContract.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: masterContract.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and masterContract are ready to use
    });
});
