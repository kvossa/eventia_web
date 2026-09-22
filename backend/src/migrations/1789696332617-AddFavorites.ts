import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFavorites1789696332617 implements MigrationInterface {
    name = 'AddFavorites1789696332617'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "favorites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "event_id" uuid NOT NULL, CONSTRAINT "PK_890818d27523748dd36a4d1bdc8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_favorites_user" ON "favorites"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_favorites_event" ON "favorites"  ("event_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_favorites_user_event" ON "favorites"  ("user_id", "event_id") `);
        await queryRunner.query(`ALTER TABLE "favorites" ADD CONSTRAINT "FK_35a6b05ee3b624d0de01ee50593" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "favorites" ADD CONSTRAINT "FK_b4bd4b6a0d2dca5cfa98905bb81" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "favorites" DROP CONSTRAINT "FK_b4bd4b6a0d2dca5cfa98905bb81"`);
        await queryRunner.query(`ALTER TABLE "favorites" DROP CONSTRAINT "FK_35a6b05ee3b624d0de01ee50593"`);
        await queryRunner.query(`DROP INDEX "public"."uq_favorites_user_event"`);
        await queryRunner.query(`DROP INDEX "public"."idx_favorites_event"`);
        await queryRunner.query(`DROP INDEX "public"."idx_favorites_user"`);
        await queryRunner.query(`DROP TABLE "favorites"`);
    }

}
