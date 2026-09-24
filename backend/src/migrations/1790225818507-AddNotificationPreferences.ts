import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationPreferences1790225818507 implements MigrationInterface {
    name = 'AddNotificationPreferences1790225818507'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "email_notifications" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "users" ADD "sms_notifications" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "sms_notifications"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_notifications"`);
    }

}
