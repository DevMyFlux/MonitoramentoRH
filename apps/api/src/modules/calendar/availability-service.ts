export type AvailabilityReason = {
  code: string;
  message: string;
  eventId?: string;
};

export type AvailabilityEvent = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  type: {
    code: string;
    name: string;
    blocksAvailability: boolean;
  };
};

export type AvailabilityResult = {
  available: boolean;
  reasonCodes: string[];
  reasons: AvailabilityReason[];
};

export function calculateAvailability(
  events: AvailabilityEvent[],
  interval: { startsAt: Date; endsAt: Date }
): AvailabilityResult {
  const blockingEvents = events.filter(
    (event) => event.type.blocksAvailability && overlaps(event, interval)
  );

  const reasons =
    blockingEvents.length === 0
      ? [
          {
            code: "AVAILABLE",
            message: "Colaborador disponivel no periodo informado."
          }
        ]
      : blockingEvents.map((event) => ({
          code: "BLOCKED_BY_EVENT",
          message: `${event.type.name}: ${event.title}`,
          eventId: event.id
        }));

  return {
    available: blockingEvents.length === 0,
    reasonCodes: reasons.map((reason) => reason.code),
    reasons
  };
}

function overlaps(
  event: { startsAt: Date; endsAt: Date },
  interval: { startsAt: Date; endsAt: Date }
): boolean {
  return event.startsAt <= interval.endsAt && event.endsAt >= interval.startsAt;
}
