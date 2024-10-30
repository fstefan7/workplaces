import { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module";
import { PrismaService } from "../modules/prisma/prisma.service";
import { WorkplacesService } from "../modules/workplaces/workplaces.service";

class Workplace {
    workplaceId: number;
    shifts: number;

    constructor(workplaceId: number, shifts: number) {
      this.workplaceId = workplaceId;
      this.shifts = shifts;
    }
}

async function getTopActiveWorkplaces(app: INestApplicationContext, workplacesLimit: number): Promise<Workplace[]> {
    const prisma: PrismaService = app.get(PrismaService);

    const topWorkplaces = await prisma.shift.groupBy({
        by: ['workplaceId'],
        _count: {
        _all: true,
        },
        orderBy: {
        _count: {
            id: 'desc',
        },
        },
        where: {
        workplace: {
            status: 0,
        },
        },
        take: workplacesLimit,
    });

    return topWorkplaces.map(topWorkplace => new Workplace(
        topWorkplace.workplaceId,
        topWorkplace._count._all)
    )
}

async function buildWorkplacesOutput(app: INestApplicationContext, topWorkplaces: Workplace[]) {
    const workplacesService: WorkplacesService = app.get(WorkplacesService);

    const workplacesWithShiftCounts = await Promise.all(
        topWorkplaces.map(async (workplace) => {
            const workplaceData = await workplacesService.getById(workplace.workplaceId)
            if (!workplaceData) {
                throw new Error(`Workplace ${workplace.workplaceId} not found`)
            }
            return {
                name: workplaceData.name || "Workplace With No Name",
                shifts: workplace.shifts,
            };

        })
    );

    return workplacesWithShiftCounts
}



async function fetchTopWorkplaces(workplacesLimit: number) {
    const app: INestApplicationContext = await NestFactory.createApplicationContext(AppModule);

    try {
        const topWorkplaces: Workplace[] = await getTopActiveWorkplaces(app, workplacesLimit)
        const workplacesOutput = await buildWorkplacesOutput(app, topWorkplaces)

        console.log(workplacesOutput);
    } catch (error) {
        console.error("Error fetching workplaces:", error);
        throw error;
    } finally {
        await app.close();
    }
}


const WORKPLACES_LIMIT = 3
fetchTopWorkplaces(WORKPLACES_LIMIT);
