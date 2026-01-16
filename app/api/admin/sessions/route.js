import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function GET(req) {
    try {
        // 1. Security Check
        const session = await getServerSession(authOptions);
        const secret = req.headers.get('x-admin-secret');
        const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'OWNER';

        // Allow if Admin User OR Secret Match (for dev/testing)
        if (!isAdmin && secret !== process.env.NEXTAUTH_SECRET) {
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        // 2. Fetch Sessions
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const page = parseInt(searchParams.get('page') || '0');
        const sort = searchParams.get('sort') || 'timestamp';
        const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
        // Filters
        const action = searchParams.get('action') || "";
        const userId = searchParams.get('userId') || "";
        const roomId = searchParams.get('roomId') || "";

        // Helper: Build filter condition (supports ! prefix for exclusion)
        const buildFilter = (field, value, options = {}) => {
            if (!value) return {};
            const isExclude = value.startsWith('!');
            const cleanValue = isExclude ? value.slice(1) : value;
            if (!cleanValue) return {};

            const condition = options.exact
                ? cleanValue
                : { contains: cleanValue, mode: 'insensitive' };
            return isExclude
                ? { NOT: { [field]: condition } }
                : { [field]: condition };
        };

        // Build Where
        const where = {
            AND: [
                action ? (action.startsWith('!')
                    ? { NOT: { action: action.slice(1) } }
                    : { action: action }) : {},
                userId ? (userId.startsWith('!') ? {
                    NOT: {
                        OR: [{ userId: { contains: userId.slice(1) } }, { displayName: { contains: userId.slice(1), mode: 'insensitive' } }]
                    }
                } : {
                    OR: [{ userId: { contains: userId } }, { displayName: { contains: userId, mode: 'insensitive' } }]
                }) : {},
                buildFilter('roomId', roomId),
            ]
        };

        // Build Order
        let orderBy = {};
        if (sort === 'timestamp') orderBy = { timestamp: dir };
        else if (sort === 'action') orderBy = { action: dir };
        else if (sort === 'displayName') orderBy = { displayName: dir };
        else if (sort === 'roomId') orderBy = { roomId: dir };
        else if (sort === 'ipAddress') orderBy = { ipAddress: dir };
        else orderBy = { timestamp: 'desc' };

        const sessions = await prisma.userSession.findMany({
            where,
            take: limit,
            skip: page * limit,
            orderBy,
            include: {
                // Optional: Include relation if we added one (we didn't, but we store userId)
            }
        });

        const count = await prisma.userSession.count({ where });

        return NextResponse.json({
            success: true,
            data: sessions,
            pagination: {
                total: count,
                page,
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Session API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
