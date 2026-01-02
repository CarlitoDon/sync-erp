export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  color:
    | 'blue'
    | 'green'
    | 'purple'
    | 'amber'
    | 'emerald'
    | 'red'
    | 'gray';
  isAnimated?: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

const colorMap: Record<TimelineEvent['color'], string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
  gray: 'bg-gray-300',
};

export function Timeline({ events, className = '' }: TimelineProps) {
  if (events.length === 0) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Vertical line - connects all dots */}
      <div className="absolute left-[5px] top-1.5 bottom-[26px] w-0.5 bg-gray-200"></div>

      <div className="space-y-5">
        {events.map((event) => (
          <div
            key={event.id}
            className="relative flex items-start gap-4 pl-6"
          >
            <div
              className={`absolute left-0 w-3 h-3 rounded-full border-2 border-white z-10 ${colorMap[event.color]} ${event.isAnimated ? 'animate-pulse' : ''}`}
            ></div>
            <div>
              <p
                className={`font-medium text-sm ${event.titleClassName || ''}`}
              >
                {event.title}
              </p>
              <p
                className={`text-xs ${event.descriptionClassName || 'text-gray-500'}`}
              >
                {event.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Timeline;
