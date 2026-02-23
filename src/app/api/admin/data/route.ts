import { NextResponse } from 'next/server'
import {
  getAllLaundromats,
  getAllOrders,
  getAllPayments,
  getAllServices,
  getAllPromoCodes,
} from '@/lib/actions'

export async function GET() {
  const [laundromats, orders, payments, services, promos] = await Promise.all([
    getAllLaundromats(),
    getAllOrders(),
    getAllPayments(),
    getAllServices(),
    getAllPromoCodes(),
  ])
  return NextResponse.json({ laundromats, orders, payments, services, promos })
}
