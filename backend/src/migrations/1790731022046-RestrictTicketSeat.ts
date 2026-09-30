import { MigrationInterface, QueryRunner } from "typeorm";

export class RestrictTicketSeat1790731022046 implements MigrationInterface {
    name = 'RestrictTicketSeat1790731022046'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_ec055dae7b2350f2acf72fcc63c"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_ec055dae7b2350f2acf72fcc63c" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_ec055dae7b2350f2acf72fcc63c"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_ec055dae7b2350f2acf72fcc63c" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
