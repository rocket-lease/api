import { DomainException } from './domain.exception';

export class ChatNotAllowedException extends DomainException {
  constructor() {
    super(
      'Chat is only available for reservations in confirmed or in_progress status',
    );
  }
}
