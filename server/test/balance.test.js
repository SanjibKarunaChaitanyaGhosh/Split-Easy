// Unit tests for the balance + settlement logic. Run with:  npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { splitPaise, computeStatus, computeBalances, suggestSettlements } from '../utils/balance.js'

const people = [
    { id: 'A', name: 'Asha' },
    { id: 'B', name: 'Ravi' },
    { id: 'C', name: 'Meera' },
]
const row = (res, id) => res.rows.find((r) => r.id === id)

test('splitPaise: parts always add up to the total (remainder is handed out)', () => {
    assert.deepEqual(splitPaise(1000, 3), [334, 333, 333])
    assert.equal(splitPaise(1000, 3).reduce((a, b) => a + b, 0), 1000)
    assert.deepEqual(splitPaise(10000, 4), [2500, 2500, 2500, 2500])
    assert.equal(splitPaise(1, 3).reduce((a, b) => a + b, 0), 1)
    for (const total of [1, 7, 99, 100, 12345, 99999]) {
        for (const n of [1, 2, 3, 5, 7]) {
            assert.equal(splitPaise(total, n).reduce((a, b) => a + b, 0), total)
        }
    }
})

test('spec example: Rs.1000 lunch + Rs.2000 dinner for the whole trip, 3 people', () => {
    const expenses = [
        { amount: 1000, paidBy: 'A', splitMode: 'whole', status: 'confirmed' }, // lunch
        { amount: 2000, paidBy: 'B', splitMode: 'whole', status: 'confirmed' }, // dinner
    ]
    const res = computeBalances({ participants: people, expenses })
    assert.equal(res.totalSpent, 3000)
    assert.equal(res.equalShare, 1000)
    assert.equal(row(res, 'A').net, 0) // lunch payer: gets nothing back, owes nothing
    assert.equal(row(res, 'B').net, 1000) // dinner payer gets Rs.1000 back
    assert.equal(row(res, 'C').net, -1000) // third person owes Rs.1000
    assert.deepEqual(res.settlements, [{ from: 'C', fromName: 'Meera', to: 'B', toName: 'Ravi', amount: 1000 }])
})

test('tagged split only divides between the tagged people', () => {
    const expenses = [{ amount: 900, paidBy: 'A', splitMode: 'tagged', splitAmong: ['A', 'B'], status: 'confirmed' }]
    const res = computeBalances({ participants: people, expenses })
    assert.equal(row(res, 'A').share, 450)
    assert.equal(row(res, 'B').share, 450)
    assert.equal(row(res, 'C').share, 0)
    assert.equal(row(res, 'A').net, 450)
    assert.equal(row(res, 'B').net, -450)
    assert.equal(row(res, 'C').net, 0)
})

test('rounding: shares of Rs.1000 between 3 add up to exactly Rs.1000', () => {
    const expenses = [{ amount: 1000, paidBy: 'A', splitMode: 'whole', status: 'confirmed' }]
    const res = computeBalances({ participants: people, expenses })
    const totalShares = res.rows.reduce((s, r) => s + Math.round(r.share * 100), 0)
    assert.equal(totalShares, 100000)
    const totalNet = res.rows.reduce((s, r) => s + Math.round(r.net * 100), 0)
    assert.equal(totalNet, 0) // balances always cancel out
})

test('only confirmed expenses count, unless "include pending" is on; disputed never count', () => {
    const expenses = [
        { amount: 300, paidBy: 'A', splitMode: 'whole', status: 'confirmed' },
        { amount: 600, paidBy: 'A', splitMode: 'whole', status: 'pending' },
        { amount: 900, paidBy: 'A', splitMode: 'whole', status: 'disputed' },
    ]
    assert.equal(computeBalances({ participants: people, expenses }).totalSpent, 300)
    assert.equal(computeBalances({ participants: people, expenses, includePending: true }).totalSpent, 900)
})

test('recorded payments reduce the balances', () => {
    const expenses = [{ amount: 3000, paidBy: 'A', splitMode: 'whole', status: 'confirmed' }]
    // B and C each owe A Rs.1000
    let res = computeBalances({ participants: people, expenses })
    assert.equal(row(res, 'A').net, 2000)
    assert.equal(res.settlements.length, 2)
    // B pays A Rs.1000
    res = computeBalances({ participants: people, expenses, payments: [{ from: 'B', to: 'A', amount: 1000 }] })
    assert.equal(row(res, 'B').net, 0)
    assert.equal(row(res, 'A').net, 1000)
    assert.deepEqual(res.settlements.map((s) => [s.from, s.to, s.amount]), [['C', 'A', 1000]])
    // everyone paid up -> nothing left to settle
    res = computeBalances({
        participants: people,
        expenses,
        payments: [{ from: 'B', to: 'A', amount: 1000 }, { from: 'C', to: 'A', amount: 1000 }],
    })
    assert.equal(res.settlements.length, 0)
    assert.ok(res.rows.every((r) => r.net === 0))
})

test('settlement never needs more than (people - 1) payments and clears every balance', () => {
    const many = ['P1', 'P2', 'P3', 'P4', 'P5'].map((id) => ({ id, name: id }))
    const expenses = [
        { amount: 1234.56, paidBy: 'P1', splitMode: 'whole', status: 'confirmed' },
        { amount: 800, paidBy: 'P2', splitMode: 'tagged', splitAmong: ['P2', 'P3', 'P5'], status: 'confirmed' },
        { amount: 45.5, paidBy: 'P4', splitMode: 'tagged', splitAmong: ['P1', 'P4'], status: 'confirmed' },
    ]
    const res = computeBalances({ participants: many, expenses })
    assert.ok(res.settlements.length <= many.length - 1)
    // apply the suggested payments and check everybody ends on zero
    const net = Object.fromEntries(res.rows.map((r) => [r.id, Math.round(r.net * 100)]))
    for (const s of res.settlements) {
        net[s.from] += Math.round(s.amount * 100)
        net[s.to] -= Math.round(s.amount * 100)
    }
    assert.ok(Object.values(net).every((v) => v === 0))
})

test('computeStatus: pending / confirmed / disputed', () => {
    assert.equal(computeStatus([]), 'confirmed')
    assert.equal(computeStatus([{ status: 'confirmed' }, { status: 'confirmed' }]), 'confirmed')
    assert.equal(computeStatus([{ status: 'confirmed' }, { status: 'pending' }]), 'pending')
    assert.equal(computeStatus([{ status: 'pending' }, { status: 'disputed' }]), 'disputed')
})

test('suggestSettlements on already balanced rows returns nothing', () => {
    assert.deepEqual(suggestSettlements([{ id: 'A', name: 'A', net: 0 }]), [])
})
