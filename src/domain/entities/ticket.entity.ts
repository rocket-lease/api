export interface TicketProps {
  id: string;
  reservationId: string;
  reportedBy: 'conductor' | 'rentador';
  reporterId: string;
  status: 'open' | 'under_review' | 'resolved' | 'rejected';
  description: string;
  photoUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class Ticket {
  private constructor(private readonly props: TicketProps) {}

  static create(params: Omit<TicketProps, 'status' | 'createdAt' | 'updatedAt'>): Ticket {
    return new Ticket({
      ...params,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPersistence(props: TicketProps): Ticket {
    return new Ticket(props);
  }

  getId()            { return this.props.id; }
  getReservationId() { return this.props.reservationId; }
  getReportedBy()    { return this.props.reportedBy; }
  getReporterId()    { return this.props.reporterId; }
  getStatus()        { return this.props.status; }
  getDescription()   { return this.props.description; }
  getPhotoUrls()     { return this.props.photoUrls; }
  getCreatedAt()     { return this.props.createdAt; }
  getUpdatedAt()     { return this.props.updatedAt; }
}
