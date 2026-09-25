import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSeatMap1790292870255 implements MigrationInterface {
    name = 'AddSeatMap1790292870255'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "seats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "row_id" uuid NOT NULL, "number" integer NOT NULL, "is_accessible" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_3fbc74bb4638600c506dcb777a7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0a0d39c966a8d737edc8756cdc" ON "seats"  ("row_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e3b9ba5746a908c498629c816c" ON "seats"  ("row_id", "number") `);
        await queryRunner.query(`CREATE TABLE "sections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "venue_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_f9749dd3bffd880a497d007e450" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a1ebf4e93c5b612438f71bd30e" ON "sections"  ("venue_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ea4f49f48bba380b19a39eb7d" ON "sections"  ("venue_id", "sort_order") `);
        await queryRunner.query(`CREATE TABLE "seat_rows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "section_id" uuid NOT NULL, "label" character varying(50) NOT NULL, CONSTRAINT "PK_775278ff98babb5cd6ba7e601e3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c6985838b8bb4aa1c8fbed76e9" ON "seat_rows"  ("section_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c1056daabd626e5cab65805198" ON "seat_rows"  ("section_id", "label") `);
        await queryRunner.query(`ALTER TABLE "seats" ADD CONSTRAINT "FK_0a0d39c966a8d737edc8756cdc0" FOREIGN KEY ("row_id") REFERENCES "seat_rows"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sections" ADD CONSTRAINT "FK_a1ebf4e93c5b612438f71bd30eb" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "seat_rows" ADD CONSTRAINT "FK_c6985838b8bb4aa1c8fbed76e96" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "seat_rows" DROP CONSTRAINT "FK_c6985838b8bb4aa1c8fbed76e96"`);
        await queryRunner.query(`ALTER TABLE "sections" DROP CONSTRAINT "FK_a1ebf4e93c5b612438f71bd30eb"`);
        await queryRunner.query(`ALTER TABLE "seats" DROP CONSTRAINT "FK_0a0d39c966a8d737edc8756cdc0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c1056daabd626e5cab65805198"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c6985838b8bb4aa1c8fbed76e9"`);
        await queryRunner.query(`DROP TABLE "seat_rows"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ea4f49f48bba380b19a39eb7d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1ebf4e93c5b612438f71bd30e"`);
        await queryRunner.query(`DROP TABLE "sections"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e3b9ba5746a908c498629c816c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0a0d39c966a8d737edc8756cdc"`);
        await queryRunner.query(`DROP TABLE "seats"`);
    }

}
