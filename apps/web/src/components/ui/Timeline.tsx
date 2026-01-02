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
  children?: TimelineEvent[];
  isMergePoint?: boolean;
  href?: string;
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
      {/* Main vertical line */}
      <svg
        className="absolute left-0 top-0 w-full h-full pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <marker id="none" />
        </defs>
        {/* We'll draw lines in the event rendering */}
      </svg>

      <div className="space-y-5">
        {events.map((event, index) => {
          const hasBranches =
            event.children && event.children.length > 0;
          const nextEvent = events[index + 1];
          const isLast = index === events.length - 1;

          return (
            <div key={event.id} className="relative">
              {/* Vertical line to next event (if not last) */}
              {!isLast && !hasBranches && (
                <svg
                  className="absolute pointer-events-none"
                  style={{
                    left: '5px',
                    top: '14px',
                    width: '2px',
                    height: 'calc(100% + 8px)',
                  }}
                >
                  <line
                    x1="1"
                    y1="0"
                    x2="1"
                    y2="100%"
                    stroke="#e5e7eb"
                    strokeWidth="2"
                  />
                </svg>
              )}

              {/* Main event row */}
              <div className="relative flex items-start gap-4 pl-6">
                {/* Dot */}
                <div
                  className={`absolute left-0 w-3 h-3 rounded-full border-2 border-white z-10 ${colorMap[event.color]} ${event.isAnimated ? 'animate-pulse' : ''}`}
                ></div>

                {/* Content */}
                <div className="flex-1">
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

              {/* Branch container */}
              {hasBranches && (
                <div className="relative ml-6 mt-3">
                  {/* SVG for branch lines */}
                  <svg
                    className="absolute pointer-events-none"
                    style={{
                      left: '-18px',
                      top: '-12px',
                      width: '30px',
                      height: `calc(100% + ${nextEvent ? '32px' : '12px'})`,
                      overflow: 'visible',
                    }}
                  >
                    {/* Vertical line through all branches */}
                    <line
                      x1="6"
                      y1="12"
                      x2="6"
                      y2={`calc(100% - ${nextEvent?.isMergePoint ? '0' : '20'}px)`}
                      stroke="#e5e7eb"
                      strokeWidth="2"
                    />

                    {/* Horizontal connectors to each branch */}
                    {event.children!.map((_, idx) => (
                      <line
                        key={idx}
                        x1="6"
                        y1={12 + idx * 52}
                        x2="24"
                        y2={12 + idx * 52}
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                    ))}
                  </svg>

                  {/* Branch items */}
                  <div className="space-y-4 pl-4">
                    {event.children!.map((child) => (
                      <div
                        key={child.id}
                        className="relative flex items-start gap-3"
                      >
                        {/* Child dot */}
                        <div
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${colorMap[child.color]} ${child.isAnimated ? 'animate-pulse' : ''}`}
                        ></div>

                        {/* Child content */}
                        <div className="flex-1 min-w-0">
                          {child.href ? (
                            <a
                              href={child.href}
                              className={`font-medium text-sm hover:underline text-blue-600 ${child.titleClassName || ''}`}
                            >
                              {child.title}
                            </a>
                          ) : (
                            <p
                              className={`font-medium text-sm ${child.titleClassName || ''}`}
                            >
                              {child.title}
                            </p>
                          )}
                          <p
                            className={`text-xs ${child.descriptionClassName || 'text-gray-500'}`}
                          >
                            {child.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Line from branches to merge point */}
                  {nextEvent?.isMergePoint && (
                    <svg
                      className="absolute pointer-events-none"
                      style={{
                        left: '-18px',
                        bottom: '-28px',
                        width: '30px',
                        height: '28px',
                        overflow: 'visible',
                      }}
                    >
                      <line
                        x1="6"
                        y1="0"
                        x2="6"
                        y2="28"
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                    </svg>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Timeline;
