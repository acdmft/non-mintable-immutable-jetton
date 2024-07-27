import { toNano } from '@ton/core';
import { MasterContract } from '../wrappers/MasterContract';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const masterContract = provider.open(MasterContract.createFromConfig({}, await compile('MasterContract')));

    await masterContract.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(masterContract.address);

    // run methods on `masterContract`
}
