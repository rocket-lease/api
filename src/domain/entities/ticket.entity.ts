import { InvalidEntityDataException } from '../exceptions/domain.exception';

export interface TicketProps {
  id: string;
  reservationId: string | null;
  type: 'vehicle_issue' | 'counterpart_report' | 'support_request';
  reportedBy: 'conductor' | 'rentador' | null;
  reporterId: string;
  status: 'open' | 'under_review' | 'resolved' | 'closed';
  subject: string;
  description: string;
  photoUrls: string[];
  rating: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Ticket {
  private constructor(private readonly props: TicketProps) {}

  static create(params: Omit<TicketProps, 'status' | 'rating' | 'createdAt' | 'updatedAt'>): Ticket {
    return new Ticket({
      ...params,
      status: 'open',
      rating: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPersistence(props: TicketProps): Ticket {
    return new Ticket(props);
  }

  withRating(rating: number): Ticket {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new InvalidEntityDataException('rating must be an integer between 1 and 5');
    }
    return new Ticket({ ...this.props, rating, updatedAt: new Date() });
  }

  withStatus(status: TicketProps['status']): Ticket {
    return new Ticket({ ...this.props, status, updatedAt: new Date() });
  }

  getId()            { return this.props.id; }
  getReservationId() { return this.props.reservationId; }
  getType()          { return this.props.type; }
  getReportedBy()    { return this.props.reportedBy; }
  getReporterId()    { return this.props.reporterId; }
  getStatus()        { return this.props.status; }
  getSubject()       { return this.props.subject; }
  getDescription()   { return this.props.description; }
  getPhotoUrls()     { return this.props.photoUrls; }
  getRating()        { return this.props.rating; }
  getCreatedAt()     { return this.props.createdAt; }
  getUpdatedAt()     { return this.props.updatedAt; }
}
