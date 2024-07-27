import { Dictionary, beginCell, Cell } from '@ton/core';
import { sha256_sync } from '@ton/crypto'

export function toSha256(s: string): bigint {
    return BigInt('0x' + sha256_sync(s).toString('hex'))
}

export function toTextCell(s: string): Cell {
    return beginCell().storeUint(0, 8).storeStringTail(s).endCell()
}

export function toNumberCell(n: number): Cell {
    return beginCell().storeUint(0,8).storeUint(0,8).endCell()
}

export type masterContent = {
    name: string,
    description: string,
    symbol: string,
    decimals: number,
    image: string
}

// export type itemContent = {
//     name: string,
//     description: string,
//     image: string,
// }

export function buildMasterContentCell(content: masterContent): Cell {
    const masterContentDict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())
        .set(toSha256("name"), toTextCell(content.name))
        .set(toSha256("description"), toTextCell(content.description))
        .set(toSha256("symbol"), toTextCell(content.symbol))
        .set(toSha256("dicmals"), toNumberCell(content.decimals))
        .set(toSha256("image"), toTextCell(content.image));
    
    return beginCell() // need to fix 
            .storeUint(0,8)
            .storeDict(masterContentDict)
            .endCell(); 
    }

// export function setItemContentCell(content: itemContent): Cell {
//     const itemContentDict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())
//         .set(toSha256("name"), toTextCell(content.name))
//         .set(toSha256("description"), toTextCell(content.description))
//         .set(toSha256("image"), toTextCell(content.image))
//     return beginCell()
//             .storeUint(0,8)
//             .storeDict(itemContentDict)
//             .endCell(); 
// }