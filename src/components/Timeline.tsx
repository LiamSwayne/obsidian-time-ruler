import _ from 'lodash'
import { DateTime } from 'luxon'
import { Fragment, useEffect, useState, useMemo, useRef } from 'react'
import { shallow } from 'zustand/shallow'
import { setters, useAppStore } from '../app/store'
import { openTaskInRuler } from '../services/obsidianApi'
import {
  isDateISO,
  insertTextAtCaret,
  removeNestedChildren,
  isCompleted,
} from '../services/util'
import Button from './Button'
import Droppable from './Droppable'
import Event from './Event'
import Times, { TimeSpanTypes } from './Times'
import TimeSpan from './TimeSpan'
import Task from './Task'
import invariant from 'tiny-invariant'
import NewTask from './NewTask'
import { useDroppable } from '@dnd-kit/core'
import { roundMinutes } from '../services/util'

export default function Timeline({
  startISO,
  endISO,
  type,
  hideTimes = false,
}: {
  startISO: string
  endISO: string
  type: TimeSpanTypes
  hideTimes?: boolean
}) {
  const now = DateTime.now().toISO() as string
  const events = useAppStore((state) => {
    return _.filter(
      state.events,
      (event) =>
        !(
          event.endISO <= startISO ||
          event.startISO >= endISO ||
          event.endISO <= now
        )
    )
  }, shallow)

  const isToday =
    startISO.slice(0, 10) === (DateTime.now().toISODate() as string)

  const [tasks, dueTasks, allDayTasks] = useAppStore((state) => {
    const tasks: TaskProps[] = []
    const dueTasks: TaskProps[] = []
    const allDayTasks: TaskProps[] = []
    _.forEach(state.tasks, (task) => {
      const scheduledForToday =
        !isCompleted(task) &&
        task.scheduled &&
        task.scheduled < endISO &&
        (isToday || task.scheduled >= startISO)
      if (
        !scheduledForToday &&
        task.due &&
        !isCompleted(task) &&
        (task.due >= startISO || (isToday && task.due < endISO)) &&
        (!task.scheduled || task.scheduled < endISO)
      ) {
        dueTasks.push(task)
      } else if (scheduledForToday) {
        invariant(task.scheduled)
        if (task.scheduled > startISO) {
          tasks.push(task)
        } else {
          allDayTasks.push(task)
        }
      }
    })

    const scheduledParents = tasks.map((task) => task.id)

    for (let id of scheduledParents) {
      removeNestedChildren(id, allDayTasks)
    }

    return [tasks, dueTasks, allDayTasks]
  }, shallow)

  const allDayEvents: EventProps[] = []
  const atTimeEvents: EventProps[] = []
  for (let event of events) {
    if (isDateISO(event.startISO)) allDayEvents.push(event)
    else atTimeEvents.push(event)
  }

  const allTimeObjects = (tasks as (TaskProps | EventProps)[]).concat(
    atTimeEvents
  )

  const blocks = _.groupBy(allTimeObjects, (object) =>
    object.type === 'event' ? object.startISO : object.scheduled
  )
  const sortedBlocks = _.sortBy(_.entries(blocks), 0)
  const timeBlocks = sortedBlocks.filter(([time, _tasks]) => time > startISO)

  const title = DateTime.fromISO(startISO || endISO).toFormat(
    type === 'days' ? 'MMMM' : 'EEE, MMM d'
  )

  const calendarMode = useAppStore((state) => state.calendarMode)

  const hidingTimes = hideTimes || calendarMode

  const timeSpan = (
    <TimeSpan
      {...{ startISO, endISO, type, blocks: timeBlocks }}
      startWithHours={startISO !== DateTime.now().toISODate()}
      hideTimes={hidingTimes}
    />
  )

  const [expanded, setExpanded] = useState(true)

  const foundTaskInAllDay = useAppStore((state) => {
    return state.findingTask &&
      allDayTasks.find((task) => task.id === state.findingTask)
      ? state.findingTask
      : null
  })

  const expandIfFound = () => {
    if (foundTaskInAllDay && !expanded) {
      setExpanded(true)
      const foundTask = allDayTasks.find(
        (task) => task.id === foundTaskInAllDay
      ) as TaskProps
      if (!foundTask) return
      setters.set({ findingTask: null })
      setTimeout(() =>
        openTaskInRuler(foundTask.position.start.line, foundTask.path)
      )
    }
  }
  useEffect(expandIfFound, [foundTaskInAllDay])

  const allDayFrame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!expanded) return
    const frame = allDayFrame.current
    invariant(frame)
    if (!calendarMode) {
      const parentFrame = frame.parentElement
      invariant(parentFrame)
      const parentHeight = parentFrame.getBoundingClientRect().height
      const frameHeight = frame.getBoundingClientRect().height
      if (frameHeight > parentHeight / 2)
        frame.style.setProperty('height', `${_.round(parentHeight / 2)}px`)
    } else {
      frame.style.setProperty('height', '')
    }
  }, [calendarMode])

  return (
    <div className='flex h-full w-full flex-col'>
      <Droppable data={{ scheduled: startISO }} id={startISO + '::timeline'}>
        <div className='group flex w-full flex-none items-center h-10 pl-1'>
          <div className='w-full pl-8'>{title || ''}</div>
          <Button
            className='aspect-square h-8'
            onClick={() => setExpanded(!expanded)}
            src={expanded ? 'chevron-up' : 'chevron-down'}
          />
          <NewTask containerId={title} />
        </div>
      </Droppable>
      <div
        className={`flex h-0 grow flex-col space-y-2 ${
          calendarMode ? 'overflow-y-auto' : ''
        }`}
        data-auto-scroll={calendarMode ? 'y' : undefined}
      >
        <div
          className={`relative w-full space-y-2 overflow-y-auto overflow-x-hidden rounded-lg ${
            calendarMode
              ? ''
              : // @ts-ignore
                `${app.isMobile ? 'max-h-[40%]' : 'max-h-[80%]'} flex-none`
          } ${!expanded ? 'hidden' : 'block'}`}
          style={{ resize: !calendarMode ? 'vertical' : 'none' }}
          data-auto-scroll={calendarMode ? undefined : 'y'}
          ref={allDayFrame}
        >
          <div>
            {_.sortBy(dueTasks, 'due', 'scheduled').map((task) => (
              <Task
                key={task.id}
                id={task.id}
                type='deadline'
                dragContainer={startISO}
              />
            ))}
          </div>
          {allDayEvents.map((event) => (
            <Event
              key={event.id}
              id={event.id}
              tasks={[]}
              blocks={[]}
              startISO={startISO}
              endISO={event.startISO}
            />
          ))}
          {allDayTasks.length > 0 && (
            <Event
              tasks={allDayTasks}
              blocks={[]}
              startISO={startISO}
              endISO={startISO}
            />
          )}
        </div>

        <div
          className={`flex h-0 w-full grow flex-col overflow-x-hidden rounded-lg ${
            calendarMode ? '' : 'overflow-y-auto'
          }`}
          data-auto-scroll={calendarMode ? undefined : 'y'}
        >
          {isToday && <NowTime />}
          {timeSpan}
          <Droppable
            data={{ scheduled: startISO }}
            id={startISO + '::timeline::end'}
          >
            <div className='h-0 grow'></div>
          </Droppable>
        </div>
      </div>
    </div>
  )
}

function NowTime() {
  const startISO = roundMinutes(new DateTime(DateTime.now())).toISO({
    includeOffset: false,
    suppressMilliseconds: true,
    suppressSeconds: true,
  })
  const { isOver, setNodeRef } = useDroppable({
    id: startISO + '::scheduled::now',
    data: { scheduled: startISO } as DropData,
  })

  return (
    <div
      className={`py-2 flex w-full items-center rounded-lg px-5 ${
        isOver ? 'bg-selection' : ''
      }`}
      ref={setNodeRef}
    >
      <div className='w-full border-0 border-b border-solid border-red-800'></div>
      <div className='h-1 w-1 rounded-full bg-red-800'></div>
    </div>
  )
}
