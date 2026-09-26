// Documents: upload company material and generate a draft question pack from it (spec §3).
import { useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router'
import { useDeleteDocument, useDocuments, useGenerate, useUpload } from '../api/hooks'
import type { Level } from '../api/types'
import { PROFESSIONS } from '../lib/professions'
import { LEVELS, formatDate } from './format'
import { Empty, ErrorNote, Loading, PageHead } from './ui'

const TYPES = ['pdf', 'docx', 'txt', 'md']
const MAX_BYTES = 20 * 1024 * 1024

function checkFile(f: File): string | null {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (!TYPES.includes(ext)) return `“${f.name}” isn’t a PDF, DOCX, TXT or MD file.`
  if (f.size > MAX_BYTES) return `“${f.name}” is ${(f.size / 1048576).toFixed(1)} MB. Files can be up to 20 MB.`
  if (f.size === 0) return `“${f.name}” is empty.`
  return null
}

function kindOf(filename: string) {
  return (filename.split('.').pop() ?? 'file').toUpperCase()
}

export function Documents() {
  const docs = useDocuments()
  const upload = useUpload()
  const del = useDeleteDocument()
  const generate = useGenerate()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [gen, setGen] = useState<{ profession: string; level: Level; count: number }>({ profession: 'all', level: 2, count: 8 })
  const [genDoc, setGenDoc] = useState<number | null>(null)

  function send(f: File | undefined) {
    if (!f) return
    setUploaded(null)
    const problem = checkFile(f)
    setFileError(problem)
    if (problem) return
    upload.mutate({ file: f }, { onSuccess: (d) => setUploaded(`Uploaded “${d.title}” (${d.words.toLocaleString('en-IN')} words).`) })
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    send(e.dataTransfer.files[0])
  }

  function run(docId: number) {
    setGenDoc(docId)
    generate.mutate({ docId, body: gen }, { onSuccess: (r) => navigate(`/admin/packs/${r.pack_id}`), onSettled: () => setGenDoc(null) })
  }

  function remove(id: number, title: string) {
    if (confirm(`Delete “${title}” and every pack made from it? This can’t be undone.`)) del.mutate(id)
  }

  return (
    <>
      <PageHead
        title="Documents"
        sub="Upload a policy, product guide or playbook. AI writes questions from it only, and every quote is checked word for word."
      />

      <div
        className={over ? 'drop over' : 'drop'}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={input}
          id="doc-file"
          type="file"
          accept=".pdf,.docx,.txt,.md"
          className="sr-only"
          onChange={(e) => {
            send(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {upload.isPending ? (
          <Loading label="Uploading and reading the file…" />
        ) : (
          <>
            <h3>Drop a file here</h3>
            <p className="muted">PDF, DOCX, TXT or MD · up to 20 MB</p>
            <button type="button" className="btn primary" onClick={() => input.current?.click()}>
              Choose a file
            </button>
          </>
        )}
      </div>
      {fileError && (
        <p className="alert bad" role="alert">
          {fileError}
        </p>
      )}
      <ErrorNote error={upload.error} />
      {uploaded && (
        <p className="alert good" role="status">
          {uploaded}
        </p>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Your documents</h2>
          <div className="gen-controls" role="group" aria-label="Pack settings">
            <label>
              <span>For</span>
              <select value={gen.profession} onChange={(e) => setGen({ ...gen, profession: e.target.value })}>
                <option value="all">All staff</option>
                {PROFESSIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Level</span>
              <select value={gen.level} onChange={(e) => setGen({ ...gen, level: Number(e.target.value) as Level })}>
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Questions</span>
              <input
                type="number"
                min={3}
                max={15}
                value={gen.count}
                onChange={(e) => setGen({ ...gen, count: Math.max(3, Math.min(15, Number(e.target.value) || 8)) })}
              />
            </label>
          </div>
        </div>

        <ErrorNote error={generate.error ?? del.error} />
        {docs.isPending && <Loading />}
        <ErrorNote error={docs.error} />
        {docs.data?.length === 0 && <Empty>No documents yet. Upload one above to get started.</Empty>}
        {!!docs.data?.length && (
          <ul className="list">
            {docs.data.map((d) => (
              <li key={d.id} className="item">
                <span className="fileicon" aria-label={`${kindOf(d.filename)} file`}>
                  {kindOf(d.filename)}
                </span>
                <div className="grow">
                  <b>{d.title}</b>
                  <div className="muted small">
                    {d.words.toLocaleString('en-IN')} words · {d.packs} {d.packs === 1 ? 'pack' : 'packs'} · uploaded {formatDate(d.created_at)}
                  </div>
                </div>
                <button type="button" className="btn accent" disabled={generate.isPending} onClick={() => run(d.id)}>
                  {genDoc === d.id ? (
                    <>
                      <span className="spin" aria-hidden="true" /> Writing questions…
                    </>
                  ) : (
                    'Generate pack'
                  )}
                </button>
                <button type="button" className="btn danger" disabled={generate.isPending || del.isPending} onClick={() => remove(d.id, d.title)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        {generate.isPending && (
          <p className="hint" role="status">
            Writing {gen.count} questions from the document and checking every quote. This can take up to a minute.
          </p>
        )}
      </section>
    </>
  )
}
