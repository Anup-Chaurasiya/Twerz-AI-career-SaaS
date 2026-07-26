%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% Compact one-page resume class — dense 9pt layout
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\ProvidesClass{compact}[2026/01/01 v1.0 Compact resume class]

\LoadClass[9pt,letterpaper]{article}

\usepackage[parfill]{parskip}
\setlength{\parskip}{0.25em}

\usepackage{array}
\usepackage{ifthen}
\RequirePackage{needspace}

\usepackage{hyperref}
\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    filecolor=blue,
    urlcolor=blue,
}

\pagestyle{empty}

\def \name#1{\def\@name{#1}}
\def \@name {}

\def \addressSep {$\diamond$}

\let \@addressone \relax
\let \@addresstwo \relax
\let \@addressthree \relax

\def \address #1{
  \@ifundefined{@addresstwo}{
    \def \@addresstwo {#1}
  }{
  \@ifundefined{@addressthree}{
  \def \@addressthree {#1}
  }{
     \def \@addressone {#1}
  }}
}

\def \printaddress #1{
  \begingroup
    \def \\ {\addressSep\ }
    \centerline{#1}
  \endgroup
  \par
  \addressskip
}

\def \printname {
  \begingroup
    \hfil{\MakeUppercase{\namesize\bf \@name}}\hfil
    \nameskip\break
  \endgroup
}

\let\ori@document=\document
\renewcommand{\document}{
  \ori@document
  \printname
  \@ifundefined{@addressone}{}{ \printaddress{\@addressone}}
  \@ifundefined{@addresstwo}{}{ \printaddress{\@addresstwo}}
  \@ifundefined{@addressthree}{}{ \printaddress{\@addressthree}}
}

\newenvironment{rSection}[1]{
  \needspace{3\baselineskip}
  \sectionskip
  \MakeUppercase{\bf #1}
  \sectionlineskip
  \hrule
  \vspace{0.1em}
  \begin{list}{}{ \setlength{\leftmargin}{0em} }
  \item[]
}{
  \end{list}
}

\newenvironment{rSubsection}[4]{
 \needspace{2.5\baselineskip}
   {\bf #1} \hfill {#2}
   \ifthenelse{\equal{#3}{}}{}{
    \\
    {\em #3} \hfill {\em #4}
    }\smallskip
   \begin{list}{$\cdot$}{\leftmargin=0em}
     \itemsep -0.4em \vspace{-0.4em}
   }{
   \end{list}
   \vspace{0.2em}
}

\def\namesize{\Large}
\def\addressskip{\smallskip}
\def\sectionlineskip{\smallskip}
\def\nameskip{\smallskip}
\def\sectionskip{\smallskip}
