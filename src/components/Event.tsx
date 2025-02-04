import { useDraggable } from '@dnd-kit/core'
import { DateTime } from 'luxon'
import { setters, useAppStore } from '../app/store'
import { isDateISO } from '../services/util'
import Block from './Block'
import Droppable from './Droppable'
import Times, { TimeSpanTypes } from './Times'
import TimeSpan from './TimeSpan'
import Logo from './Logo'
import Button from './Button'
import $ from 'jquery'

export type EventComponentProps = {
  id?: string
  tasks: TaskProps[]
  type?: TimeSpanTypes
  startISO: string
  endISO: string
  blocks: BlockData[]
}
export default function Event({
  id,
  tasks,
  startISO,
  endISO,
  due,
  blocks,
  type = 'minutes',
  draggable = true,
  isDragging = false,
}: EventComponentProps & {
  draggable?: boolean
  due?: boolean
  isDragging?: boolean
}) {
  if (tasks.length === 0) draggable = false
  const thisEvent = useAppStore((state) => (id ? state.events[id] : undefined))
  const dragData: DragData = {
    dragType: 'event',
    id,
    tasks,
    type,
    blocks,
    startISO,
    endISO,
  }

  const { setNodeRef, attributes, listeners, setActivatorNodeRef } =
    useDraggable({
      id: `${id}::${startISO}::${type}`,
      data: dragData,
    })

  const twentyFourHourFormat = useAppStore(
    (state) => state.twentyFourHourFormat
  )
  const today = DateTime.now().toISODate() as string
  const formatStart = (date: string) => {
    const isDate = isDateISO(date)
    return DateTime.fromISO(date).toFormat(
      isDate
        ? 'EEE MMM d'
        : date < today
        ? 'EEE MMM d t'
        : twentyFourHourFormat
        ? 'T'
        : 't'
    )
  }

  const data = due ? { due: startISO } : { scheduled: startISO }

  const eventWidth = isDragging
    ? $('#time-ruler-times').children()[0]?.getBoundingClientRect().width - 16
    : undefined

  const titleBar = (
    <div
      className={`time-ruler-block group flex h-6 w-full flex-none items-center rounded-lg pr-2 font-menu text-xs ${
        draggable ? 'selectable cursor-grab' : ''
      }`}
    >
      <div
        className='flex w-full items-center pl-8'
        {...(draggable
          ? { ref: setActivatorNodeRef, ...attributes, ...listeners }
          : undefined)}
      >
        {thisEvent && (
          <div
            className={`mr-2 w-fit min-w-[24px] flex-none whitespace-nowrap text-sm`}
          >
            {thisEvent.title}
          </div>
        )}

        <hr className='my-0 w-full border-t border-faint'></hr>

        <span className='ml-2 whitespace-nowrap'>{formatStart(startISO)}</span>
        {!DateTime.fromISO(startISO).diff(DateTime.fromISO(endISO)) && (
          <>
            <span className='ml-2 text-faint'>&gt;</span>
            <span className='ml-2 whitespace-nowrap text-muted'>
              {formatStart(endISO)}
            </span>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div
      className={`w-full rounded-lg pl-1 ${
        isDragging ? 'bg-gray-500/5 opacity-50' : 'bg-secondary-alt'
      }`}
      style={{
        minWidth: eventWidth,
      }}
      ref={draggable ? setNodeRef : undefined}
    >
      <Droppable
        data={data}
        id={startISO + '::event' + '::' + id + tasks.map((x) => x.id).join(',')}
      >
        {titleBar}
      </Droppable>

      <Block
        type='event'
        {...{ tasks, due, scheduled: startISO }}
        dragContainer={startISO}
      />

      <TimeSpan
        startISO={startISO}
        endISO={endISO}
        blocks={blocks}
        type={type}
        chopStart={true}
      />

      {thisEvent && (thisEvent.location || thisEvent.notes) && (
        <div className='flex space-x-4 py-2 pl-6 text-xs'>
          <div className='whitespace-nowrap'>{thisEvent.location}</div>
          <div className='max-w-[75%] truncate text-muted'>
            {thisEvent.notes}
          </div>
        </div>
      )}
    </div>
  )
}
