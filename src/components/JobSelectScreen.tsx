import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import ButtonBase from '@mui/material/ButtonBase'
import { ALL_CLASSES, jobsOfClass } from '../domain/jobs'
import { useBuildStore } from '../store/buildStore'

export default function JobSelectScreen() {
  const selectJob = useBuildStore((s) => s.selectJob)

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        직업 선택
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        직업은 선택 후 변경할 수 없습니다. 변경하려면 초기화 후 새로 작성하세요.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: 'repeat(5, 1fr)',
          },
          gap: 2,
        }}
      >
        {ALL_CLASSES.map((cls) => (
          <Box key={cls.id}>
            <Typography
              variant="h6"
              align="center"
              sx={{ fontWeight: 800, mb: 1.5, color: 'primary.main' }}
            >
              {cls.label}
            </Typography>
            <Stack spacing={1.5}>
              {jobsOfClass(cls.id).map((job) => (
                <ButtonBase
                  key={job.id}
                  onClick={() => selectJob(job.id)}
                  sx={{ borderRadius: 2, display: 'block' }}
                >
                  <Paper
                    variant="outlined"
                    sx={{
                      py: 2,
                      px: 1,
                      textAlign: 'center',
                      transition: 'border-color .15s, transform .1s',
                      '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-2px)',
                      },
                    }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>{job.label}</Typography>
                  </Paper>
                </ButtonBase>
              ))}
            </Stack>
          </Box>
        ))}
      </Box>
    </Container>
  )
}
