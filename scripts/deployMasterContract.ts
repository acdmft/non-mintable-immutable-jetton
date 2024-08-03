import { toNano } from '@ton/core';
import { MasterContract } from '../wrappers/MasterContract';
import { compile, NetworkProvider } from '@ton/blueprint';
import { buildMasterContentCell } from './jettonContent/onChain';

export async function run(provider: NetworkProvider) {
    const wallet_code = await compile('JettonWallet');

    const masterContract = provider.open(MasterContract.createFromConfig({
        total_supply: 888,
        mintable: -1,
        admin: provider.sender().address!!,
        content: buildMasterContentCell({
            name: "Flying fox coin",
            description: "Fruit bat coin will bring you joy!",
            symbol: "FFXC",
            decimals: 0,
            image: "https://gateway.pinata.cloud/ipfs/QmXLLGXja57hEsFa9D2L6bFTq8ZLbkAvpGqhj8bgxKaLZH"
        }),
        jetton_wallet: wallet_code
    }, await compile('MasterContract')));

    await masterContract.sendDeploy(provider.sender(), toNano('0.05'));

    await provider.waitForDeploy(masterContract.address);

    // run methods on `masterContract`
}
