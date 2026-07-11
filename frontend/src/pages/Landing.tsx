import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { stashResume } from '../lib/fileStash'
import { LogoMark } from '../components/Logo'
import { Desktop, DeskFile, Draggable, MenuBar, Sticker, Window } from '../components/desktop'

// Landing «Рабочий стол» (structure 3a, typography 4a «Афиша»): the job hunt
// as a messy OS desktop — hero with draggable junk files, then windowed
// sections: how-it-works pipeline, разбор + трекер previews, FAQ inbox,
// final CTA modal, dock and footer.

function Notification({
  delay,
  icon,
  title,
  time,
  text,
}: {
  delay: number
  icon: React.ReactNode
  title: string
  time: string
  text: React.ReactNode
}) {
  return (
    <div
      className="flex gap-3 rounded-[14px] border border-ink/14 bg-paper/92 p-3.5 shadow-card backdrop-blur-lg"
      style={{ animation: `notifin .6s ${delay}s cubic-bezier(.2,.8,.2,1) both` }}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="flex justify-between">
          <b className="font-sans text-[13px] font-bold">{title}</b>
          <span className="font-sans text-[11px] text-steel">{time}</span>
        </span>
        <span className="mt-0.5 block font-sans text-[12.5px]/[1.4] text-ink-soft">{text}</span>
      </span>
    </div>
  )
}

// Dashed connector between pipeline steps.
function DashLine() {
  return (
    <div
      className="mx-4.5 h-[3px] max-lg:hidden"
      style={{
        backgroundImage: 'linear-gradient(90deg,var(--color-ink) 55%,transparent 45%)',
        backgroundSize: '26px 3px',
        backgroundRepeat: 'repeat-x',
        animation: 'dashmove .8s linear infinite',
      }}
    />
  )
}

function MiniFile({ kind, badge, label }: { kind: 'in' | 'out'; badge: string; label: React.ReactNode }) {
  return (
    <div className="w-[118px] text-center">
      <div
        className={`relative mx-auto h-[66px] w-[56px] rounded-[7px] bg-white ${
          kind === 'out'
            ? 'border-[1.5px] border-accent shadow-[0_8px_20px_rgba(194,40,122,.2)]'
            : 'border-[1.5px] border-ink/35'
        }`}
      >
        {kind === 'in' && (
          <span className="absolute -top-px -right-px h-0 w-0 rounded-tr-[6px] rounded-bl-lg border-t-[15px] border-l-[15px] border-t-paper border-l-paper" />
        )}
        <span
          className={`absolute bottom-1 left-1 rounded px-1.25 py-0.5 font-mono text-[8px] font-bold text-white ${
            kind === 'out' ? 'bg-accent' : badge === 'PDF' ? 'bg-file-pdf' : 'bg-ink-soft'
          }`}
        >
          {badge}
        </span>
      </div>
      <div className={`mt-1.5 font-sans text-xs ${kind === 'out' ? 'font-semibold' : 'font-medium text-ink-soft'}`}>
        {label}
      </div>
    </div>
  )
}

// Circular «СООТВЕТСТВИЕ» stamp on the разбор preview.
function Stamp() {
  return (
    <div className="absolute top-6 right-6 h-[112px] w-[112px] rotate-[10deg] opacity-90 max-sm:hidden">
      <svg viewBox="0 0 120 120" width="112" height="112">
        <circle cx="60" cy="60" r="56" fill="none" stroke="var(--color-accent)" strokeWidth="3" />
        <circle cx="60" cy="60" r="39" fill="none" stroke="var(--color-accent)" strokeWidth="1.4" />
        <path id="stamp-path" d="M 60,60 m -47,0 a 47,47 0 1,1 94,0 a 47,47 0 1,1 -94,0" fill="none" />
        <text style={{ font: "700 11px 'Ubuntu Mono',monospace", letterSpacing: '.18em', fill: 'var(--color-accent)' }}>
          <textPath href="#stamp-path">СООТВЕТСТВИЕ · GETYOUROFFER ·</textPath>
        </text>
        <text
          x="60"
          y="72"
          textAnchor="middle"
          style={{ font: "600 30px 'Oswald Variable',sans-serif", fill: 'var(--color-accent)' }}
        >
          84
        </text>
      </svg>
    </div>
  )
}

function DockIcon({ to, title, children }: { to: string; title: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      title={title}
      className="inline-block transition duration-200 hover:-translate-y-1.5 hover:scale-115"
    >
      {children}
    </Link>
  )
}

export default function Landing() {
  const { authed } = useAuth()
  const navigate = useNavigate()
  const cta = authed ? '/app/new' : '/register'
  const [dragOver, setDragOver] = useState(false)

  // Dropping a real PDF onto the hero window stashes it and jumps into the app.
  function onHeroDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) stashResume(file)
    navigate(cta)
  }

  return (
    <div className="min-h-screen">
      <MenuBar />

      {/* One continuous desktop wallpaper for the whole page. */}
      <Desktop>
        {/* ——— Hero ——— */}
        <div className="relative overflow-hidden select-none xl:h-[920px]">
        <div className="relative z-10 max-w-[600px] px-6 pt-16 sm:px-12 xl:absolute xl:top-[84px] xl:left-16 xl:px-0 xl:pt-0">
          <div className="kicker mb-5.5 inline-flex items-center gap-2 rounded-full border border-accent/35 bg-paper/70 px-3.5 py-1.75 text-accent">
            ✥ Файлы на столе можно таскать мышью
          </div>
          <h1 className="display mb-5.5 text-[56px] sm:text-[84px]">
            Весь хаос поиска — <span className="display-stroke">в одно окно.</span>
          </h1>
          <p className="mb-7.5 max-w-[480px] font-sans text-lg/[1.55] text-ink-mute">
            Двенадцать версий резюме, письма в заметках, табличка откликов. GetYourOffer собирает
            отклик под вакансию за минуту — резюме, разбор, письмо, трекер.
          </p>
          <div className="flex items-center gap-3.5">
            <Link
              to={cta}
              className="inline-block rounded-[14px] bg-accent px-7.5 py-4.5 font-sans text-[16.5px] font-bold text-accent-ink shadow-cta transition hover:-translate-y-0.5 hover:bg-ink"
            >
              Навести порядок — бесплатно
            </Link>
            <span className="font-mono text-[12.5px] text-steel">
              3 отклика · без карты · резюме не в логах
            </span>
          </div>
        </div>

        {/* Junk files */}
        <Draggable className="top-[470px] left-[70px] z-[8] hidden xl:block">
          <DeskFile kind="PDF" tilt={-7} name={<>резюме_2023_<br />старое.pdf</>} />
        </Draggable>
        <Draggable className="top-[520px] left-[210px] z-[9] hidden xl:block">
          <DeskFile kind="PDF" tilt={4} name={<>резюме_ФИНАЛ.pdf</>} />
        </Draggable>
        <Draggable className="top-[660px] left-[150px] z-10 hidden xl:block">
          <DeskFile kind="PDF" tilt={-3} highlight name={<>резюме_финал_v12_<br />ТОЧНО_ФИНАЛ.pdf</>} />
        </Draggable>
        <Draggable className="top-[640px] left-[330px] z-[8] hidden xl:block">
          <DeskFile kind="DOCX" tilt={6} name={<>сопроводительное_<br />копия(3).docx</>} />
        </Draggable>
        <Draggable className="top-[560px] left-[475px] z-[7] hidden xl:block">
          <DeskFile kind="XLSX" tilt={-5} name={<>отклики_учёт_<br />АКТУАЛЬНАЯ.xlsx</>} />
        </Draggable>
        <Draggable className="top-[680px] left-[600px] z-[9] hidden xl:block">
          <DeskFile kind="PNG" tilt={3} name={<>скрин_вакансии_<br />не_потерять.png</>} />
        </Draggable>
        <Draggable className="top-[398px] left-[530px] z-[11] hidden xl:block">
          <Sticker footnote="(висит тут с марта)">follow-up в «Клевер» — НЕ ЗАБЫТЬ!!</Sticker>
        </Draggable>

        {/* Product window */}
        <div className="relative z-20 mx-auto mt-12 w-full max-w-[640px] px-6 pb-16 animate-popin sm:px-12 xl:absolute xl:top-24 xl:right-14 xl:mt-0 xl:px-0 xl:pb-0">
          <Window title="GetYourOffer — новый отклик" right="⌘N" className="shadow-window!">
            <div className="p-6">
              <div className="mb-3.5 rounded-xl border border-ink/20 bg-white px-4.5 py-4">
                <div className="mb-2 flex justify-between">
                  <span className="font-sans text-[13.5px] font-bold">Текст вакансии</span>
                  <span className="font-mono text-[10.5px] text-accent">✓ похоже на вакансию</span>
                </div>
                <div className="font-sans text-[13px]/[1.65] text-ink-mute">
                  Продуктовый аналитик, «Нейра» — Москва, гибрид. Ожидаем: SQL, Python, A/B-тесты,
                  юнит-экономика, retention…
                  <span className="ml-0.5 inline-block h-3.5 w-[7px] -translate-y-0.5 animate-blink bg-accent align-middle" />
                </div>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onHeroDrop}
                className={`mb-4.5 flex items-center gap-3 rounded-xl border-[1.5px] border-dashed px-4.5 py-3.5 transition ${
                  dragOver ? 'border-accent bg-accent/12' : 'border-accent/60 bg-accent/5'
                }`}
              >
                <span className="flex h-9.5 w-7.5 flex-none items-center justify-center rounded-[5px] bg-accent font-mono text-[8.5px] font-bold text-white">
                  PDF
                </span>
                <span className="flex-1">
                  <b className="font-sans text-[13.5px] font-bold">Перетащите резюме сюда</b>
                  <span className="mt-0.5 block font-mono text-[11.5px] text-steel">
                    любая версия — хоть v12_ТОЧНО_ФИНАЛ
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-3.5">
                <Link
                  to={cta}
                  className="block flex-1 rounded-xl bg-ink p-4 text-center font-sans text-[15px] font-bold text-paper transition hover:bg-accent"
                >
                  Собрать отклик →
                </Link>
                <span className="font-mono text-[13px] font-semibold text-steel tabular-nums">~00:58</span>
              </div>
            </div>
          </Window>
        </div>

        {/* Notifications */}
        <div className="absolute top-[520px] right-6 z-[22] hidden w-[330px] flex-col gap-2.5 xl:flex">
          <Notification
            delay={1.6}
            icon={<LogoMark size={34} />}
            title="GetYourOffer"
            time="сейчас"
            text="Пакет отклика готов за 58 сек: резюме, разбор 84/100, письмо ✓"
          />
          <Notification
            delay={2.4}
            icon={
              <span className="flex h-8.5 w-8.5 flex-none items-center justify-center rounded-[9px] bg-accent font-sans text-[15px] font-extrabold text-accent-ink">
                Н
              </span>
            }
            title="Почта — «Нейра»"
            time="2 мин"
            text="«Анна, добрый день! Хотим позвать вас на интервью…»"
          />
        </div>

        {/* Trash can */}
        <Draggable className="right-24 bottom-13 z-[12] hidden xl:block">
          <div className="w-[110px] text-center">
            <div className="relative mx-auto h-[66px] w-[58px]">
              <span className="absolute top-0 left-1/2 h-[7px] w-[34px] -translate-x-1/2 rounded-t-[3px] bg-ink-soft" />
              <span className="absolute inset-x-0 top-1.5 bottom-0 rounded-t-md rounded-b-[9px] bg-gradient-to-b from-ink-mute to-ink-soft" />
              {[10, 20, 30, 40].map((x) => (
                <span key={x} className="absolute top-3.5 h-11 w-[3px] rounded-sm bg-paper/35" style={{ left: x }} />
              ))}
            </div>
            <div className="mt-1.5 font-sans text-[11.5px] font-medium text-ink-soft">
              Корзина
              <span className="block font-mono text-[10.5px] text-steel">резюме_старое ×9</span>
            </div>
          </div>
        </Draggable>
        </div>

        {/* ——— Windowed sections ——— */}
        <div className="pt-[70px]">
        {/* How it works */}
        <div id="how" className="mx-auto mb-[78px] max-w-[1200px] px-6">
          <Window title="как_это_работает.app" right="58 сек">
            <div className="px-6 pt-11 pb-10 sm:px-11">
              <div className="grid items-center gap-y-10 lg:grid-cols-[auto_1fr_auto_1fr_auto]">
                <div className="flex flex-col gap-4.5 max-lg:flex-row max-lg:justify-center">
                  <MiniFile kind="in" badge="TXT" label="вакансия.txt" />
                  <MiniFile kind="in" badge="PDF" label="резюме.pdf" />
                </div>
                <DashLine />
                <div className="text-center">
                  <div className="relative mx-auto h-[104px] w-[104px] rounded-[26px] bg-ink shadow-[0_20px_44px_rgba(16,18,22,.3)]">
                    <span className="absolute top-3 left-4.5 font-display text-[56px]/none font-extrabold text-paper">
                      G
                    </span>
                    <span className="absolute right-3.5 bottom-2.5 font-display text-4xl/none font-black text-accent">
                      →
                    </span>
                  </div>
                  <div className="mx-auto mt-3.5 h-[7px] w-[104px] overflow-hidden rounded bg-ink/12">
                    <span
                      className="block h-[7px] rounded bg-accent"
                      style={{
                        ['--w' as string]: '100%',
                        animation: 'growbar 2.4s cubic-bezier(.2,.8,.2,1) infinite',
                      }}
                    />
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-steel">один вызов · строгий JSON</div>
                </div>
                <DashLine />
                <div className="flex gap-3.5 max-lg:justify-center max-sm:flex-col max-sm:items-center">
                  <MiniFile kind="out" badge="2.0" label={<>резюме<br />под вакансию</>} />
                  <MiniFile kind="out" badge="84" label={<>честный<br />разбор</>} />
                  <MiniFile kind="out" badge="✉" label={<>письмо на языке<br />вакансии</>} />
                </div>
              </div>
              <div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-ink/12 pt-4.5 font-sans text-[13.5px] text-ink-mute">
                <span>
                  <b className="text-ink">Никакого скрапинга.</b> Вакансия — просто текстом, откуда угодно.
                </span>
                <span>
                  <b className="text-ink">Плюс запись в трекер</b> — статус «черновик» уже стоит.
                </span>
              </div>
            </div>
          </Window>
        </div>

        {/* Разбор + трекер previews */}
        <div className="mx-auto mb-[78px] flex max-w-[1200px] items-start gap-6.5 px-6 max-lg:flex-col">
          <Window title="разбор_соответствия.pdf — Просмотр" tilt={-0.6} className="flex-[1.08] max-lg:w-full">
            <div className="relative px-8 py-7.5">
              <Stamp />
              <div className="kicker mb-2.5 text-[11px] text-steel">Отклик #0347 · Нейра</div>
              <div className="display mb-4.5 text-[26px]">Разбор без лести</div>
              <div className="flex max-w-[430px] flex-col gap-2.5 font-sans text-[13.5px]/[1.5]">
                <div className="flex gap-2.5">
                  <b className="flex-none text-accent">+</b>
                  <span>
                    <b>A/B-тесты</b> — «30+ экспериментов, +18% к конверсии»
                  </span>
                </div>
                <div className="flex gap-2.5">
                  <b className="flex-none text-accent">+</b>
                  <span>
                    <b>SQL/Python</b> — «пайплайны метрик с нуля»
                  </span>
                </div>
                <div className="flex gap-2.5">
                  <b className="flex-none text-accent">+</b>
                  <span>
                    <b>Юнит-экономика</b> — «LTV/CAC трёх продуктов»
                  </span>
                </div>
                <div className="mt-1.5 flex gap-2.5">
                  <b className="flex-none">−</b>
                  <span>
                    <b>ClickHouse</b> → совет: подчеркнуть Postgres, стек переносится
                  </span>
                </div>
                <div className="flex gap-2.5">
                  <b className="flex-none">−</b>
                  <span>
                    <b>Английский</b> → совет: указать B2, это «плюс», не требование
                  </span>
                </div>
              </div>
            </div>
          </Window>

          <Window title="Трекер — все отклики" right="12" tilt={0.5} className="flex-[.92] max-lg:w-full lg:mt-6.5">
            <div className="flex">
              <div className="flex w-[132px] flex-none flex-col gap-1.5 border-r border-ink/12 bg-[#EEF0F4] px-3 py-3.5 font-sans text-[12.5px] font-medium max-sm:hidden">
                <span className="rounded-[7px] bg-accent/14 px-2.5 py-1.5 font-bold text-ink">Все · 12</span>
                <span className="px-2.5 py-1.5 text-ink-mute">Активные · 7</span>
                <span className="px-2.5 py-1.5 text-ink-mute">Офферы · 1</span>
                <span className="px-2.5 py-1.5 text-ink-mute">Архив · 4</span>
              </div>
              <div className="flex-1">
                {(
                  [
                    ['Нейра · аналитик', 'оффер ✓', 'bg-accent text-accent-ink'],
                    ['Клевер · данные', 'ответ', 'bg-ink text-paper'],
                    ['Штиль · маркетинг', 'отправлено', 'border-[1.5px] border-ink'],
                    ['Планка · воронка', 'черновик', 'border-[1.5px] border-dashed border-ink/40 text-steel'],
                  ] as const
                ).map(([name, status, style]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between border-b border-ink/8 px-4 py-3 transition hover:bg-accent/5"
                  >
                    <span className="font-sans text-[13px] font-semibold">{name}</span>
                    <span className={`rounded-full px-2.5 py-0.75 font-sans text-[10.5px] font-bold ${style}`}>
                      {status}
                    </span>
                  </div>
                ))}
                <Link to={cta} className="block px-4 py-3 font-sans text-[12.5px] font-semibold text-accent">
                  + новый отклик — минута
                </Link>
              </div>
            </div>
          </Window>
        </div>

        {/* Trust */}
        <div id="trust" className="mx-auto mb-[78px] max-w-[1200px] px-6">
          <h2 className="display mb-7 text-center text-4xl">
            Почему нам можно <span className="display-stroke">доверять.</span>
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {(
              [
                [
                  'Данные при вас',
                  'Резюме не попадает в логи и не передаётся никому, кроме модели, которая собирает ваш пакет. Удалить отклик можно в один клик — вместе с версиями резюме.',
                ],
                [
                  'Разбор без лести',
                  'Показываем не только совпадения, но и честные пробелы с советами. Вы точно знаете, что поправить до отправки, — без ложной уверенности.',
                ],
                [
                  'Отправляете вы сами',
                  'Никаких массовых рассылок и доступа к вашим аккаунтам. Каждый отклик — одна вакансия и ваше осознанное решение отправить.',
                ],
              ] as const
            ).map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-ink/16 bg-paper p-6">
                <div className="kicker mb-3 text-[11px] text-accent">✓ {title}</div>
                <p className="font-sans text-sm/[1.6] text-ink-mute">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ inbox */}
        <div id="faq" className="mx-auto mb-[78px] max-w-[860px] px-6">
          <Window title="Входящие — частые вопросы (3)">
            <div className="py-2.5">
              {(
                [
                  ['Аня С.', '— мне', '14:02', 'Это же не массовая рассылка по всем вакансиям подряд?', false],
                  [
                    'GetYourOffer',
                    '— Ане',
                    '14:03',
                    'Нет. Один отклик — одна вакансия, и каждый собирается под неё: свои акценты в резюме, своё письмо. Отправляете вы сами — мы не трогаем ваши аккаунты.',
                    true,
                  ],
                  ['Аня С.', '— мне', '14:05', 'А моё резюме кто-то читает? Куда оно уходит?', false],
                  [
                    'GetYourOffer',
                    '— Ане',
                    '14:06',
                    'Только модель, которая собирает ваш пакет. Содержимое резюме не попадает в логи и не передаётся никому, кроме генерации. В демо честно: только своё резюме или обезличенные примеры.',
                    true,
                  ],
                ] as const
              ).map(([from, to, time, text, isReply], i, arr) => (
                <div
                  key={i}
                  className={`px-7 py-4.5 ${i < arr.length - 1 ? 'border-b border-ink/8' : ''} ${
                    isReply ? 'bg-accent/4' : ''
                  }`}
                >
                  <div className="mb-1.5 flex justify-between">
                    <b className={`font-sans text-sm font-bold ${isReply ? 'text-accent' : ''}`}>
                      {from} <span className="font-normal text-xs text-steel">{to}</span>
                    </b>
                    <span className="font-sans text-[11.5px] text-steel">{time}</span>
                  </div>
                  <div className="font-sans text-sm/[1.6] text-ink-soft">
                    {text}
                    {isReply && (
                      <span className="mt-2 block font-sans text-xs text-steel italic">Отправлено с телефона</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Window>
        </div>

        {/* Final CTA modal + dock + footer */}
        <div className="pt-5 text-center">
          <div className="inline-block w-full max-w-[560px] px-6 animate-popin">
            <div className="overflow-hidden rounded-[18px] border-[1.5px] border-ink bg-paper text-center shadow-[0_40px_90px_rgba(16,18,22,.3)]">
              <div className="px-10 pt-9 pb-8.5">
                <div className="mx-auto mb-5 w-fit">
                  <LogoMark size={64} />
                </div>
                <div className="display mb-2.5 text-4xl">
                  Освободить себе
                  <br />
                  40 вечеров?
                </div>
                <div className="mb-6.5 font-sans text-[14.5px]/[1.5] text-ink-mute">
                  Примерно столько уходит на отклики за один поиск работы.
                </div>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="rounded-xl border-[1.5px] border-ink/35 px-5.5 py-3.5 font-sans text-[14.5px] font-semibold text-ink-mute transition hover:border-ink hover:text-ink"
                  >
                    Не сегодня
                  </button>
                  <Link
                    to={cta}
                    className="rounded-xl bg-accent px-6.5 py-3.5 font-sans text-[14.5px] font-bold text-accent-ink shadow-cta transition hover:bg-ink"
                  >
                    Да, начать бесплатно
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Dock */}
          <div className="mt-16 flex justify-center px-6">
            <div className="inline-flex items-end gap-3.5 rounded-[22px] border border-ink/16 bg-paper/75 px-4.5 py-3 shadow-[0_20px_50px_rgba(16,18,22,.2)] backdrop-blur-xl">
              <DockIcon to="/" title="GetYourOffer">
                <LogoMark size={52} />
              </DockIcon>
              <DockIcon to={cta} title="Как это работает">
                <span className="flex h-13 w-13 items-center justify-center rounded-[14px] bg-accent">
                  <span className="relative h-5 w-7 overflow-hidden rounded bg-accent-ink">
                    <span className="absolute top-1 left-1/2 h-0 w-0 -translate-x-1/2 border-t-[11px] border-r-[7px] border-l-[7px] border-t-accent border-r-transparent border-l-transparent rotate-180" />
                  </span>
                </span>
              </DockIcon>
              <DockIcon to={authed ? '/app/tracker' : '/register'} title="Трекер">
                <span className="grid h-13 w-13 grid-cols-2 gap-1 rounded-[14px] bg-ink-soft p-3">
                  <span className="rounded-sm bg-[#EEF0F4]" />
                  <span className="rounded-sm bg-[#EEF0F4] opacity-60" />
                  <span className="rounded-sm bg-[#EEF0F4] opacity-60" />
                  <span className="rounded-sm bg-accent" />
                </span>
              </DockIcon>
              <span className="h-11 w-px bg-ink/18" />
              <DockIcon to={cta} title="3 отклика бесплатно">
                <span className="flex h-13 w-13 items-center justify-center rounded-[14px] border border-ink/20 bg-[#EEF0F4] font-mono text-[11px] font-bold text-accent">
                  3 free
                </span>
              </DockIcon>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-ink/14 bg-paper/85 px-6 py-3.5 text-left font-sans text-[12.5px] font-medium text-ink-mute">
            <span>© 2026 GetYourOffer</span>
            <span className="font-mono text-[11.5px]">
              резюме не логируем · вечера не возвращаем — их у вас снова много
            </span>
          </div>
        </div>
        </div>
      </Desktop>
    </div>
  )
}
