import { Link } from "react-router-dom";

export function NovelCard(props: { slug: string; title: string; coverUrl: string }) {
  return (
    <Link className="card" to={`/novel/${props.slug}`}>
      <img src={props.coverUrl} alt={props.title} loading="lazy" />
      <span>{props.title}</span>
    </Link>
  );
}
