import { Entity, PrimaryColumn } from 'typeorm';

@Entity('ticket_type_sections')
export class TicketTypeSection {
  @PrimaryColumn({ name: 'ticket_type_id', type: 'uuid' })
  ticketTypeId: string;

  @PrimaryColumn({ name: 'section_id', type: 'uuid' })
  sectionId: string;
}