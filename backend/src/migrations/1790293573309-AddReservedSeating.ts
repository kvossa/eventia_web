import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReservedSeating1790293573309 implements MigrationInterface {
    name = 'AddReservedSeating1790293573309'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cart_item_seats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cart_item_id" uuid NOT NULL, "seat_id" uuid NOT NULL, "seat_label" character varying(255) NOT NULL, CONSTRAINT "PK_c02684d44b0343684155c4ca8b7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5cae3100c5eea5d7a5ecf77a4b" ON "cart_item_seats"  ("cart_item_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_19c9b0d3a86bad3048d45f237c" ON "cart_item_seats"  ("seat_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_37961888d662ee8e86d78029dd" ON "cart_item_seats"  ("cart_item_id", "seat_id") `);
        await queryRunner.query(`CREATE TABLE "ticket_type_sections" ("ticket_type_id" uuid NOT NULL, "section_id" uuid NOT NULL, CONSTRAINT "PK_3fc9de17f486126fcfb0fd38958" PRIMARY KEY ("ticket_type_id", "section_id"))`);
        await queryRunner.query(`ALTER TABLE "events" ADD "reserved_seating" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD "seat_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_ec055dae7b2350f2acf72fcc63" ON "tickets"  ("seat_id") `);
        await queryRunner.query(`ALTER TABLE "cart_item_seats" ADD CONSTRAINT "FK_5cae3100c5eea5d7a5ecf77a4b3" FOREIGN KEY ("cart_item_id") REFERENCES "cart_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cart_item_seats" ADD CONSTRAINT "FK_19c9b0d3a86bad3048d45f237c9" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_ec055dae7b2350f2acf72fcc63c" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_type_sections" ADD CONSTRAINT "FK_tts_ticket_type" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_type_sections" ADD CONSTRAINT "FK_tts_section" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_tickets_active_event_seat" ON "tickets" ("event_id", "seat_id") WHERE "seat_id" IS NOT NULL AND "status" NOT IN ('refunded', 'cancelled')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_tickets_active_event_seat"`);
        await queryRunner.query(`ALTER TABLE "ticket_type_sections" DROP CONSTRAINT "FK_tts_ticket_type"`);
        await queryRunner.query(`ALTER TABLE "ticket_type_sections" DROP CONSTRAINT "FK_tts_section"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_ec055dae7b2350f2acf72fcc63c"`);
        await queryRunner.query(`ALTER TABLE "cart_item_seats" DROP CONSTRAINT "FK_19c9b0d3a86bad3048d45f237c9"`);
        await queryRunner.query(`ALTER TABLE "cart_item_seats" DROP CONSTRAINT "FK_5cae3100c5eea5d7a5ecf77a4b3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec055dae7b2350f2acf72fcc63"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP COLUMN "seat_id"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "reserved_seating"`);
        await queryRunner.query(`DROP TABLE "ticket_type_sections"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_37961888d662ee8e86d78029dd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_19c9b0d3a86bad3048d45f237c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5cae3100c5eea5d7a5ecf77a4b"`);
        await queryRunner.query(`DROP TABLE "cart_item_seats"`);
    }

}
